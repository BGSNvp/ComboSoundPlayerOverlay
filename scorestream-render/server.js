"use strict";

/**
 * ScoreStream render service.
 *
 * Loads a ScoreStream widget URL in a persistent headless-Chrome page and
 * serves the current view as a PNG. This lets constrained webviews (YoloBox)
 * display the scoreboard as a same-origin <img> instead of a cross-origin
 * iframe, which they render unreliably.
 *
 * Endpoints:
 *   GET /shot?url=<scorestream url>&w=1280&h=220  -> image/png
 *   GET /healthz                                  -> ok
 */

const express = require("express");
const puppeteer = require("puppeteer");

const PORT = process.env.PORT || 8080;
const MIN_SHOT_INTERVAL_MS = Number(process.env.MIN_SHOT_INTERVAL_MS || 60000);
const PAGE_IDLE_TTL_MS = Number(process.env.PAGE_IDLE_TTL_MS || 300000);
const ALLOWED_HOST = "scorestream.com";

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
      ],
    });
  }
  return browserPromise;
}

// Cache of live pages keyed by "url|w|h".
const pages = new Map();

function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      (u.hostname === ALLOWED_HOST || u.hostname.endsWith("." + ALLOWED_HOST))
    );
  } catch (e) {
    return false;
  }
}

function wrapperHtml(url, w, h) {
  // ScoreStream's Cloudflare check challenges direct top-level navigation but
  // not the widget when it's *embedded* in an iframe (its intended use). So we
  // serve a same-origin wrapper page that embeds the widget and screenshot it.
  const safeUrl = url.replace(/"/g, "&quot;");
  return (
    "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
    "<style>html,body{margin:0;padding:0;background:#000;overflow:hidden;}" +
    "iframe{border:0;display:block;width:" + w + "px;height:" + h + "px;}</style>" +
    "</head><body><iframe src=\"" + safeUrl + "\"></iframe></body></html>"
  );
}

async function getEntry(url, w, h) {
  const key = url + "|" + w + "|" + h;
  let entry = pages.get(key);
  if (entry) return entry;

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(wrapperHtml(url, w, h), {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  // Give the embedded widget a moment to paint its first frame.
  await new Promise((r) => setTimeout(r, 3500));

  entry = { page, buffer: null, shotAt: 0, lastUsed: Date.now(), rendering: null };
  pages.set(key, entry);
  return entry;
}

async function shoot(entry) {
  entry.buffer = await entry.page.screenshot({ type: "png" });
  entry.shotAt = Date.now();
  return entry.buffer;
}

async function evictIdlePages() {
  const now = Date.now();
  for (const [key, entry] of pages) {
    if (now - entry.lastUsed > PAGE_IDLE_TTL_MS) {
      pages.delete(key);
      try {
        await entry.page.close();
      } catch (e) {
        /* ignore */
      }
    }
  }
}
setInterval(() => {
  evictIdlePages().catch(() => {});
}, 30000);

const app = express();

app.get("/healthz", (req, res) => res.type("text").send("ok"));

app.get("/shot", async (req, res) => {
  const url = String(req.query.url || "");
  const w = Math.min(Math.max(parseInt(req.query.w, 10) || 1280, 100), 3840);
  const h = Math.min(Math.max(parseInt(req.query.h, 10) || 220, 40), 2160);

  if (!isAllowedUrl(url)) {
    res.status(400).type("text").send("url must be an https scorestream.com URL");
    return;
  }

  try {
    const entry = await getEntry(url, w, h);
    entry.lastUsed = Date.now();

    const stale = Date.now() - entry.shotAt >= MIN_SHOT_INTERVAL_MS;
    if (!entry.buffer || stale) {
      if (!entry.rendering) {
        entry.rendering = shoot(entry).finally(() => {
          entry.rendering = null;
        });
      }
      // If we already have a buffer, serve it immediately and let the fresh
      // shot land for next time; otherwise wait for the first render.
      if (!entry.buffer) await entry.rendering;
    }

    res.set("Cache-Control", "no-store");
    res.set("Access-Control-Allow-Origin", "*");
    res.type("png").send(entry.buffer);
  } catch (e) {
    res.status(502).type("text").send("render error: " + e.message);
  }
});

app.listen(PORT, () => {
  console.log("scorestream-render listening on " + PORT);
});

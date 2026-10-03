# scorestream-render

Small service that renders a [ScoreStream](https://scorestream.com) scoreboard
widget to a PNG so constrained webviews (e.g. YoloBox) can display it as a
**same-origin image** instead of an unreliable cross-origin iframe.

It works by embedding the widget in an iframe inside a wrapper page (its
intended use — which bypasses ScoreStream's Cloudflare bot-check that blocks
direct headless navigation) and screenshotting it with headless Chrome.

## Endpoints

- `GET /shot?url=<scorestream widget url>&w=1280&h=220` → `image/png`
- `GET /healthz` → `ok`

`url` must be an `https://scorestream.com/...` URL. The rendered page is kept
alive and re-screenshotted at most once per `MIN_SHOT_INTERVAL_MS` (default
60s); requests in between get the cached image.

## Run locally

```bash
npm install
npm start   # listens on :8080
curl "http://localhost:8080/shot?url=https%3A%2F%2Fscorestream.com%2Fwidgets%2Fscoreboards%2Fhorz%3FuserWidgetId%3D52317&w=1280&h=220" -o out.png
```

## Deploy to Render (free)

This repo includes `render.yaml`. On Render: **New → Blueprint**, connect this
repo, and it will build the Docker image and expose the service. No credit card
required on the free plan (the instance sleeps after ~15 min idle).

## Config

| Env var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Listen port |
| `MIN_SHOT_INTERVAL_MS` | `60000` | Minimum time between re-renders per widget |
| `PAGE_IDLE_TTL_MS` | `300000` | Close a widget's page after this idle time |
| `PUPPETEER_EXECUTABLE_PATH` | (bundled) | Path to Chromium (set to `/usr/bin/chromium` in Docker) |

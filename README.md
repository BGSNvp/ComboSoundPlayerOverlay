# Combined Overlay (Player Card + Soundboard)

A single-URL web overlay for YololBox Extreme (or OBS) that combines:
- **Player card** — green-screen video with floating info fields (name, number, grade, height, weight)
- **Soundboard audio** — plays sound effects triggered from the controller

## How It Works

1. Add this page as a **Browser Source** in YololBox/OBS
2. The player card is **hidden by default** and shows for **7 seconds** when triggered from the controller
3. Sound effects play through this page's audio when triggered from the controller
4. Everything syncs in real-time via Firebase Firestore

## URLs (GitHub Pages)

- **Overlay:** `https://bgsnvp.github.io/ComboSoundPlayerOverlay/`
- **Controller:** `https://bgsnvp.github.io/ComboSoundPlayerController/`

## Setup

1. Enable GitHub Pages: Settings → Pages → Deploy from `main` branch
2. Add the overlay URL as a Browser Source in YololBox/OBS
3. Open the controller on your phone
4. Add players in the Roster tab, add sounds in the Edit Sounds tab

## Files

- `index.html` — Combined overlay page
- `overlay.css` — Player card styles
- `sounds/` — Sound effect files (mp3)
- `videos/` — Player video clips (mp4/webm/mov)

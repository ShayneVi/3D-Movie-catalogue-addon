# 3D Movies Catalogue — Stremio Addon

A personal Stremio addon that catalogues movies available in 3D formats:
- **Frame Packing** — Full-resolution Blu-ray 3D (MVC/HDMI 1.4)
- **SBS** — Side-by-Side (half or full)
- **OU** — Over/Under (Top/Bottom)
- **Anaglyph** — Red/Cyan glasses

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2a. Seed catalogue (fast — ~100 curated 3D films, instant)
```bash
node seed_catalogue.js
```

### 2b. Expand catalogue via TMDB keyword discovery (slow — hundreds more)
```bash
node fetch_3d_tmdb.js
```
> Run 2a first, then 2b for a bigger list. Or run both:
> `node seed_catalogue.js && node fetch_3d_tmdb.js`

### 3. Start the addon
```bash
node addon.js
```
Addon runs at `http://127.0.0.1:7000`

### 4. Add to Stremio
In Stremio → Settings → Addons → paste:
```
http://127.0.0.1:7000/manifest.json
```

## Catalogues exposed in Stremio

| Catalogue | Description |
|---|---|
| 3D Movies — All Formats | Full list, filterable by format or genre |
| 3D Frame Packing | Blu-ray 3D / MVC titles only |
| 3D Side-by-Side (SBS) | SBS titles |
| 3D Over/Under (OU) | OU / Top-Bottom titles |
| 3D Anaglyph | Red/Cyan anaglyph titles |

## Scripts

| Command | Description |
|---|---|
| `node seed_catalogue.js` | Build catalogue from curated IMDB ID list |
| `node fetch_3d_tmdb.js` | Expand catalogue via TMDB keyword discovery |
| `node scraper.js` | Scrape Wikipedia 3D film lists (requires internet access to Wikipedia) |
| `node enrich.js` | Enrich raw_movies.json from scraper.js with TMDB metadata |
| `node addon.js` | Start the Stremio addon server |

## Refreshing
Re-run `node seed_catalogue.js` or `node fetch_3d_tmdb.js` any time to pick up new movies.
The addon reads `catalogue.json` at startup.

## Notes
- Stremio requires IMDB IDs — movies without one are excluded automatically
- Movies without a poster are hidden from catalogue view
- TMDB rate limit: all scripts add a small delay between requests

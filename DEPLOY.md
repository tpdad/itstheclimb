# Deploying the Overhauled Site

This folder contains the complete site: `index.html`, the `js/` folder (`constants.js`, `api.js`, `dscore.js`, `recap.js`, `app.js`), plus branding/PWA assets: `og.png` (link-preview image), `site.webmanifest`, and the `icons/` folder (favicon + app icons).

## Steps

1. Copy `index.html`, the whole `js/` folder, `og.png`, `site.webmanifest`, the whole `icons/` folder, and the whole `arcade/` folder into your local clone of github.com/tpdad/itstheclimb (replacing what's there).
2. Test locally: open `index.html` in a browser. Everything runs client-side — Sleeper and FantasyCalc load live, no keys needed.
3. Deploy:
   ```
   git add index.html js/ og.png site.webmanifest icons/ arcade/
   git commit -m "Endzone Run arcade: installable PWA game + site launcher"
   git push origin main
   ```
4. Wait ~60s, verify at https://tpdad.github.io/itstheclimb/

## What's automated now (no more manual updates)

- **Trades, waivers, FA moves** — pulled live from Sleeper (The Wire)
- **Roster market values** — FantasyCalc dynasty superflex values, refreshed every 6h
- **Power rankings, playoff/relegation odds, scoring trends** — computed automatically once Week 1 kicks off (preseason shows market-based outlook)
- **Trending players** — Sleeper-wide adds/drops, flagged when available in your tiers
- **Owner careers** (Legacy → Owners) — true per-owner records rebuilt season-by-season, immune to roster-slot swaps
- **D-Score Auto-Audit** (Dynasty → Auto-Audit) — every Amendment I component computed from Sleeper history; compare vs official books, yellow = disagreement
- **Recap section** — preseason preview (market storylines + superlatives), weekly recap with awards (auto-activates Week 1, week selector), and season wraps for any completed year (champion, game of the year, streaks, final table)

## What's still manual (in js/constants.js)

- `DYNASTY_RANKS` (D-Scores) — **now synced live from the commissioner's Google Sheet** (30-min cache; sheet must stay "anyone with link can view"; team names must match Sleeper). The constants.js values are the offline fallback — refresh them occasionally. New teams still need a constants.js entry with `ownerId`.
- `DYNASTY_STATUS` (victor banner + redraft trigger progress)
- `CONSTITUTION`, `SEASON_HISTORY`, `HALL_OF_FAME`, `DYNASTY_RECORDS`, `RETIRED_OWNERS`, `IMMUNITY_TEAMS_DATA`
- New season: bump `SEASON` / `SEASON_NUM` and league IDs in `LEAGUE_MAP`


## Arcade

Endzone Run ships with the site in the `arcade/` folder (own page, own PWA). The site's Arcade tab is a launcher that links to `arcade/index.html`. The game has its own manifest (`arcade/manifest.webmanifest`, landscape fullscreen), its own icons, and a service worker (`arcade/sw.js`) so it works offline and installs to a phone home screen *as the game only*, separate from the site PWA. Deploy: `git add arcade/` along with everything else. Dev copy lives in the sibling `Endzone Run/` folder — after changing the game there, re-copy `index.html`, `js/game.js`, `assets/` (skip the Gemini_* source sheets and hires/old/raw folders), `manifest.webmanifest`, `sw.js`, and `icons/` into `The Climb/arcade/`. Bump the CACHE version string in `sw.js` when shipping game updates so installed phones pick them up.

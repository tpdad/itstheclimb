# Deploying the Overhauled Site

This folder contains the complete new site: `index.html` + `js/constants.js`, `js/api.js`, `js/dscore.js`, `js/app.js`.

## Steps

1. Copy all four files into your local clone of github.com/tpdad/itstheclimb (replacing `index.html` and the `js/` folder).
2. Test locally: open `index.html` in a browser. Everything runs client-side — Sleeper and FantasyCalc load live, no keys needed.
3. Deploy:
   ```
   git add index.html js/
   git commit -m "Overhaul: redesign + live wire, market values, analytics, trade lab"
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

## What's still manual (in js/constants.js)

- `DYNASTY_RANKS` (D-Scores) — end of season
- `DYNASTY_STATUS` (victor banner + redraft trigger progress)
- `CONSTITUTION`, `SEASON_HISTORY`, `HALL_OF_FAME`, `DYNASTY_RECORDS`, `RETIRED_OWNERS`, `IMMUNITY_TEAMS_DATA`
- New season: bump `SEASON` / `SEASON_NUM` and league IDs in `LEAGUE_MAP`

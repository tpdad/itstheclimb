# It's the Climb — DB4 Sports Official Portal

> A fantasy football dynasty league management and analytics portal powered by the Sleeper API.

## 🏔️ Overview

**It's the Climb** is a custom web application built for the **DB4 Sports** fantasy football dynasty league. It provides real-time league standings, dynasty rankings, constitution management, and h[...]

### Key Features

- 📊 **Live League Standings** — Real-time roster data pulled from Sleeper API
- 👑 **Dynasty Rankings** — Custom scoring system tracking multi-season performance
- 🏆 **Permanent Records** — Hall of Fame, individual milestones, and league history
- 📜 **Constitution** — Full searchable league rules and amendments
- 🎮 **Team Details Modal** — Comprehensive roster view with player lineups
- 🌍 **Multi-Tier Support** — Top Level, Mid League, and Cellar divisions
- ⚡ **Fast & Lightweight** — No backend required; runs entirely on GitHub Pages

---

## 🚀 Getting Started

### Live Website

The portal is live at:
```
https://tpdad.github.io/itstheclimb/
```

### Technology Stack

- **HTML/CSS/JavaScript** — Pure frontend, no backend
- **Tailwind CSS** — Utility-first styling via CDN
- **Font Awesome** — Icon library via CDN
- **Sleeper API** — Fantasy league data (read-only, public)
- **GitHub Pages** — Static hosting

---

## 📝 Customization Guide

### 1. Update Dynasty Rankings

Edit `js/constants.js` and update the `DYNASTY_RANKS` array with current season scores:

```javascript
const DYNASTY_RANKS = [
    { 
        team: 'Your Team Name',
        owners: ['sleeper_username'],
        score: 384.00,           // Total D-Score
        winPct: '74%',          // Average win percentage
        bonus: 'Championship, Division',  // CSV of achievements
        entered: 2023,          // Year team joined
        breakdown: {
            champ: 1,           // Championships won
            ptsFirst: 2,        // Points leader finishes
            playoffs: 3,        // Playoff appearances
            // ... other metrics
        }
    },
    // ... more teams
];
```

### 2. Update League IDs

If you're cloning this for another league, update the Sleeper league IDs in `js/constants.js`:

```javascript
const LEAGUE_MAP = {
    top:    { id: 'YOUR_SLEEPER_LEAGUE_ID', name: 'The Top Level', ... },
    mid:    { id: 'YOUR_SLEEPER_LEAGUE_ID', name: 'The Mid League', ... },
    cellar: { id: 'YOUR_SLEEPER_LEAGUE_ID', name: 'The Cellar', ... }
};
```

**How to find your Sleeper League ID:**
1. Go to sleeper.app and open your league
2. The URL will be: `https://sleeper.app/leagues/{LEAGUE_ID}`
3. Copy that ID

### 3. Update Constitution

Edit the `CONSTITUTION` array in `js/constants.js` to add/modify articles and amendments:

```javascript
const CONSTITUTION = [
    { 
        id: 'art1', 
        type: 'article', 
        title: 'Article I: Your Article',
        content: 'Full text of your rule...'
    },
    // ... more articles
];
```

### 4. Update Records & Hall of Fame

The `DYNASTY_RECORDS` array holds permanent league records:

```javascript
const DYNASTY_RECORDS = [
    { label: 'Single Game High Score', owner: 'Team Name', val: '234.6' },
    // ... more records
];
```

### 5. Update Immunity Status

Teams with relegation immunity (typically champions):

```javascript
const IMMUNITY_TEAMS_DATA = [
    { 
        team: 'Southie Thunder Buddies', 
        owner: 'philosopherdan', 
        expires: 2026,              // Expires after this season
        reason: '2025 Champion' 
    },
    // ... more teams
];
```

---

## 🔄 How It Works

### Data Flow

1. **Page Load** → `window.onload` initializes the app
2. **Player Map** → Fetches NFL player registry (cached 24 hours)
3. **League Data** → Calls Sleeper API for users, rosters, matchups
4. **Render** → Dynamic HTML generation from constants + API data
5. **User Interaction** → Tab switching, modal opens, search/filter

### Sleeper API Calls

The app makes the following API requests (all read-only):

| Endpoint | Purpose | Rate |
|----------|---------|------|
| `/v1/players/nfl` | Player registry (name/team mapping) | Once per 24h (cached) |
| `/v1/league/{id}/users` | League members | Per tier on tab switch |
| `/v1/league/{id}/rosters` | Rosters and scoring | Per tier on tab switch |
| `/v1/league/{id}` | League metadata (current week) | Per tier on tab switch |
| `/v1/league/{id}/matchups/{week}` | Current week matchups | Per tier on tab switch |

**Rate Limit:** 1,000 calls/minute. No issues for typical usage.

---

## 📊 Dynasty Scoring System

The **D-Score** (Dynasty Score) tracks long-term team performance across multiple seasons.

### Scoring Components

See `DSCORE_LINE_ITEMS` in `js/constants.js` for the full breakdown:

- **+100** — Championship
- **+50** — 2nd Place
- **+25** — 3rd Place or Playoff Appearance
- **+20** — Playoff Win
- **+50** — Division Win
- **+50** — Points Leader (season)
- **+25** — 2nd in Points (season)
- **+10/season** — Top Level participation
- **-25** — Relegation
- **-50** — Bottom 4 finish
- **Win %** — Average win percentage × 1 point

### Updating Scores

After each season:
1. Record final standings and playoff results
2. Update `breakdown` object for each team
3. Calculate total D-Score
4. Sort by score and update `DYNASTY_RANKS`

---

## 🛠️ Development

### Local Testing

```bash
# Clone the repo
git clone https://github.com/tpdad/itstheclimb.git
cd itstheclimb

# Serve locally (Python 3)
python -m http.server 8000

# Visit http://localhost:8000
```

### File Structure

```
itstheclimb/
├── index.html              # Main page (HTML structure)
├── js/
│   ├── constants.js        # All league data & configuration
│   └── app.js             # Application logic & Sleeper API integration
├── docs/                   # GitHub Pages source
│   └── ... (generated)
├── README.md              # This file
└── .gitignore            # Git configuration
```

### Making Changes

1. **Data Changes** (dynasty rankings, records, constitution)
   - Edit `js/constants.js`
   - Commit and push
   - Changes live within minutes on GitHub Pages

2. **Logic/UI Changes**
   - Edit `index.html` (structure) or `js/app.js` (logic)
   - Test locally
   - Commit and push

3. **Styling Changes**
   - Modify `<style>` block in `index.html`
   - Tailwind classes are loaded from CDN
   - No build step needed

---

## 📋 Constitution & League Rules

The full league constitution is embedded in the app under the **"Constitution"** tab. Key amendments:

- **Amendment I** — Dynasty Ranking scoring system
- **Amendment II** — Dynasty Victor concept and perks
- **Amendment III** — Redraft triggers (end of dynasty)
- **Amendment IV** — Force-drop keeper rules
- **Amendment V** — "Too Many Good Players" (TMGP) rule
- **Amendment VI** — Conduct code
- **Amendment X** — Sloppy Exception (promotional discretion)

All amendments are searchable via the Constitution tab.

---

## 🔗 External Links

- **League Constitution (Google Doc)** — [Full official document](https://docs.google.com/document/d/1JASaVRgcu9-bmoVFDSwpHdhnjpSfgMyd99RjWIJc1OY/edit?tab=t.0)
- **Sleeper App** — https://sleeper.app
- **Sleeper API Docs** — https://docs.sleeper.app

---

## 🤝 Contributing

To update league data:

1. Fork the repository
2. Create a branch: `git checkout -b update/dynasty-2026`
3. Edit `js/constants.js` with new rankings/records
4. Commit: `git commit -m "Update Season 4 dynasty scores"`
5. Push: `git push origin update/dynasty-2026`
6. Open a Pull Request

**For league members:** Contact @tpdad with updates.

---

## ⚠️ Limitations

- **Read-Only Data** — The Sleeper API doesn't support writes. All manual data (dynasty rankings, constitution) must be edited in code.
- **Player Projections** — The app displays rosters and lineups, not projections. Use Sleeper's native projections.
- **Historical Data** — Past seasons' data must be manually archived or pulled from Sleeper's historical endpoints.
- **Offline Mode** — Player map and league data are cached, but internet required for live updates.

---

## 📞 Support

For issues or questions:

1. Check the **Constitution** tab for league rules
2. Review the Sleeper API docs: https://docs.sleeper.app
3. Contact Current Manager: @tpdad on GitHub

---

## 📜 License

This project is custom-built for DB4 Sports. Feel free to clone and adapt for your own league!

---

**Now Maintained by @tpdad**  
**Last Updated:** May 12, 2026  
**League:** It's the Climb (1st Dynasty, Season 4)

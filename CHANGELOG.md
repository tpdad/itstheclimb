# Changelog

All notable changes to the It's the Climb portal are documented here.

## Format

This project follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-05-12

### Added
- ✅ Initial public release on GitHub Pages
- ✅ Live league standings with Sleeper API integration
- ✅ Dynasty Rankings system with D-Score calculations
- ✅ Hall of Fame and Permanent Records
- ✅ Searchable League Constitution (10 articles, 10 amendments)
- ✅ Team detail modals with lineup visualization
- ✅ Season History timeline (2023–2026)
- ✅ Multi-tier league support (Top Level, Mid League, Cellar)
- ✅ Retirement/discharge records for former owners
- ✅ Relegation immunity tracking
- ✅ Player registry caching (24-hour local storage)
- ✅ Responsive design (mobile-friendly)
- ✅ Dark theme with gold/emerald branding

### Infrastructure
- GitHub Pages hosting
- Static site (no backend required)
- CDN-hosted dependencies (Tailwind CSS, Font Awesome, Google Fonts)
- Git-based version control

---

## [Unreleased]

### Planned Features
- [ ] Draft history visualization
- [ ] Trade log and asset movement tracking
- [ ] Player trending (waiver wire activity)
- [ ] Playoff bracket simulation
- [ ] Commissioner tools (password-protected)
- [ ] Export standings to CSV/JSON
- [ ] Mobile app (React Native)
- [ ] Slack integration for score updates
- [ ] Archive past dynasties

### Known Limitations
- Manual updates required for dynasty rankings (no auto-calculation)
- Constitution updates require code changes (no admin UI)
- No projections/forecasts (display lineups only)
- Rate limit: 1,000 calls/minute on Sleeper API

---

## Update History

### How to Update

**Dynasty Rankings:**
1. After season ends, collect final standings
2. Edit `js/constants.js` → `DYNASTY_RANKS` array
3. Recalculate D-Scores based on `DSCORE_LINE_ITEMS`
4. Commit and push

**Constitution:**
1. Edit `js/constants.js` → `CONSTITUTION` array
2. Add new article or amendment with unique `id`
3. Commit with amendment name: `git commit -m "Add Amendment XI: Your Title"`

**Records:**
1. Edit `js/constants.js` → `DYNASTY_RECORDS` array
2. Update after new records are set

---

**Last Updated:** May 12, 2026  
**Current Season:** Season 4 (2026)  
**Dynasty Status:** 1st Dynasty · 2023–Present

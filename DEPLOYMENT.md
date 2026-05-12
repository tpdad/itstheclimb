# GitHub Pages Deployment Guide

## Current Status

✅ **Live at:** https://thephilosopherdan-dot.github.io/itstheclimb/

The site is automatically deployed whenever you push changes to the `main` branch.

---

## How to Deploy

### 1. Make Changes Locally

```bash
# Clone if you haven't already
git clone https://github.com/thephilosopherdan-dot/itstheclimb.git
cd itstheclimb

# Create a feature branch
git checkout -b feature/your-changes

# Make edits to files
# Test locally: python -m http.server 8000
```

### 2. Commit & Push

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Update Season 4 dynasty rankings"

# Push to GitHub
git push origin main
```

### 3. GitHub Pages Auto-Deploys

GitHub Pages will automatically rebuild and deploy within seconds. Your changes will be live at:
```
https://thephilosopherdan-dot.github.io/itstheclimb/
```

---

## GitHub Pages Settings

**Current Configuration:**
- **Source:** `main` branch
- **Root Folder:** `/` (root of repository)
- **Custom Domain:** None (using `github.io` subdomain)

### To Verify Settings:

1. Go to: https://github.com/thephilosopherdan-dot/itstheclimb/settings/pages
2. Confirm:
   - ✅ Source: `Deploy from a branch`
   - ✅ Branch: `main / (root)`
   - ✅ Enforce HTTPS: Enabled

---

## Caching & Invalidation

### Browser Cache

GitHub Pages caches assets. If changes don't appear:

1. **Hard refresh:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear localStorage** (for player map cache):
   ```javascript
   localStorage.removeItem('nfl_players_cache');
   localStorage.removeItem('nfl_players_cache_time');
   ```

### CDN Cache

Tailwind, Font Awesome, and Google Fonts are cached by their CDNs. Updates typically appear within hours.

---

## Troubleshooting

### Site Not Updating

1. **Check deployment status:**
   - Go to: https://github.com/thephilosopherdan-dot/itstheclimb/actions
   - Look for recent workflow runs
   - If failed, check error log

2. **Clear your browser cache:**
   - Hard refresh or clear site data

3. **Verify file is in right place:**
   - `index.html` should be at repository root
   - `js/constants.js` and `js/app.js` should be in `js/` folder

### 404 Errors

If you see "404 Not Found":

1. Verify file paths in `index.html` are correct
2. Check that files exist in the repository
3. Ensure branch is set to `main` in GitHub Pages settings

### Sleeper API Not Loading

1. Check internet connection
2. Verify Sleeper API is online: https://sleeper.app
3. Check browser console for CORS errors (shouldn't happen—Sleeper allows public access)

---

## Performance Tips

- **Player Map Cache** — Cached for 24 hours to reduce API calls
- **Minification** — Consider minifying JS/CSS for production (optional—not critical for static site)
- **Image Optimization** — Player avatars are already thumbnails from Sleeper CDN

---

## Rollback

If you need to revert to a previous version:

```bash
# See commit history
git log --oneline

# Revert to specific commit
git revert <commit-hash>
git push origin main

# Or reset to previous state (use with caution)
git reset --hard <commit-hash>
git push origin main --force
```

---

## Backup & Migration

All data is stored in code (`js/constants.js`), so backups are automatic via Git history.

To migrate to a new repository:

```bash
# Mirror the repository
git clone --mirror https://github.com/thephilosopherdan-dot/itstheclimb.git
cd itstheclimb.git
git push --mirror https://github.com/NEW_OWNER/NEW_REPO.git
```

---

## Contact

For deployment issues, contact: @thephilosopherdan-dot

**Last Updated:** May 12, 2026

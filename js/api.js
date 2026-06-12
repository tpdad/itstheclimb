// ═════════════════════════════════════════════════════════════════════════
//  IT'S THE CLIMB — DATA LAYER
//  Sleeper API (league live data) + FantasyCalc API (dynasty market values)
//  All browser-side, no keys. Cached in localStorage where sensible.
// ═════════════════════════════════════════════════════════════════════════

const API = (() => {

    const SLEEPER = 'https://api.sleeper.app/v1';

    // ── cache versioning: bump CACHE_V on breaking format changes ──────────
    const CACHE_V = 'v2';
    try {
        if (localStorage.getItem('climb_cache_v') !== CACHE_V) {
            Object.keys(localStorage)
                .filter(k => k.startsWith('c_') || ['fc_values_v1', 'nfl_players_v2',
                        'nfl_players_cache', 'nfl_players_cache_time'].includes(k))
                .forEach(k => localStorage.removeItem(k));
            localStorage.setItem('climb_cache_v', CACHE_V);
        }
    } catch (e) { /* private mode etc. */ }

    // ── generic cached fetch ────────────────────────────────────────────────
    async function cachedJSON(url, ttlMs, cacheKey) {
        const key = cacheKey || ('c_' + url);
        if (ttlMs > 0) {
            try {
                const hit = localStorage.getItem(key);
                if (hit) {
                    const { t, d } = JSON.parse(hit);
                    if (Date.now() - t < ttlMs) return d;
                }
            } catch (e) { /* corrupted cache — ignore */ }
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        const data = await res.json();
        if (ttlMs > 0) {
            try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); }
            catch (e) { /* quota — skip caching */ }
        }
        return data;
    }

    const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

    // ── NFL state (current week / season phase) ─────────────────────────────
    const nflState = () => cachedJSON(`${SLEEPER}/state/nfl`, 10 * MIN);

    // ── player registry (large — cache 24h, do NOT double-store) ───────────
    let _playerMap = null;
    async function playerMap() {
        if (_playerMap) return _playerMap;
        _playerMap = await cachedJSON(`${SLEEPER}/players/nfl`, DAY, 'nfl_players_v2');
        return _playerMap;
    }

    // ── league core data ────────────────────────────────────────────────────
    const league   = id => cachedJSON(`${SLEEPER}/league/${id}`, 10 * MIN);
    const users    = id => cachedJSON(`${SLEEPER}/league/${id}/users`, 10 * MIN);
    const rosters  = id => cachedJSON(`${SLEEPER}/league/${id}/rosters`, 5 * MIN);
    const matchups = (id, wk) => cachedJSON(`${SLEEPER}/league/${id}/matchups/${wk}`, 5 * MIN);
    const tradedPicks = id => cachedJSON(`${SLEEPER}/league/${id}/traded_picks`, HOUR);
    const winnersBracket = id => cachedJSON(`${SLEEPER}/league/${id}/winners_bracket`, HOUR);

    // completed weeks never change → cache long; current week stays fresh
    function transactionsWeek(id, wk, currentWeek) {
        const ttl = wk < currentWeek ? 12 * HOUR : 5 * MIN;
        return cachedJSON(`${SLEEPER}/league/${id}/transactions/${wk}`, ttl).catch(() => []);
    }

    async function allTransactions(id, currentWeek) {
        const weeks = [];
        for (let w = 1; w <= Math.max(currentWeek, 1); w++) weeks.push(w);
        const results = await Promise.all(weeks.map(w => transactionsWeek(id, w, currentWeek)));
        return results.flat().filter(t => t && t.status === 'complete');
    }

    async function allMatchups(id, throughWeek) {
        const weeks = [];
        for (let w = 1; w <= throughWeek; w++) weeks.push(w);
        const results = await Promise.all(weeks.map(w => matchups(id, w).catch(() => [])));
        return results; // array indexed by week-1
    }

    // ── trending players ────────────────────────────────────────────────────
    const trending = type => cachedJSON(`${SLEEPER}/players/nfl/trending/${type}?lookback_hours=48&limit=25`, 30 * MIN);

    // ── FantasyCalc dynasty market values ──────────────────────────────────
    let _fc = null;
    async function fcValues() {
        if (_fc) return _fc;
        const p = FC_PARAMS;
        const url = `https://api.fantasycalc.com/values/current?isDynasty=${p.isDynasty}&numQbs=${p.numQbs}&numTeams=${p.numTeams}&ppr=${p.ppr}`;
        const list = await cachedJSON(url, 6 * HOUR, 'fc_values_v1');
        const bySleeper = {}, picks = [];
        list.forEach(e => {
            if (e.player.sleeperId) bySleeper[e.player.sleeperId] = e;
            else if (/^\d{4}/.test(e.player.name)) picks.push(e); // draft picks e.g. "2027 1st"
        });
        _fc = { list, bySleeper, picks };
        return _fc;
    }

    // ── assembled league context ────────────────────────────────────────────
    // Returns everything a view needs for one tier, with derived team objects.
    const _ctxCache = {};
    async function leagueContext(tier) {
        const hit = _ctxCache[tier];
        if (hit && Date.now() - hit.t < 2 * MIN) return hit.ctx;
        const id = LEAGUE_MAP[tier].id;
        const [state, lg, us, ro] = await Promise.all([nflState(), league(id), users(id), rosters(id)]);

        // figure out how far the season has progressed for THIS league.
        // NOTE: Sleeper flags dynasty leagues 'in_season' months early, so we
        // also require the NFL itself to be in regular/post season.
        const nflLive = ['regular', 'post'].includes(state.season_type);
        const inSeason = nflLive && (lg.status === 'in_season' || lg.status === 'post_season');
        const currentWeek = inSeason ? Math.max(1, Math.min(state.week || lg.settings.leg || 1, 18)) : 1;
        const completedWeeks = inSeason ? Math.max(0, currentWeek - 1) : 0;

        const weeklyMatchups = inSeason ? await allMatchups(id, currentWeek) : [];

        // derived team objects
        const teams = ro.map(r => {
            const u = us.find(x => x.user_id === r.owner_id);
            const name = u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`;
            const scores = [];
            for (let w = 0; w < completedWeeks; w++) {
                const m = (weeklyMatchups[w] || []).find(m => m.roster_id === r.roster_id);
                if (m && m.points > 0) scores.push(m.points);
            }
            return {
                rosterId: r.roster_id, user: u, roster: r, name,
                display: u?.display_name || 'Unknown',
                avatar: u?.metadata?.avatar || u?.avatar || null, // team logo first, profile fallback
                wins: r.settings.wins, losses: r.settings.losses, ties: r.settings.ties || 0,
                fpts: r.settings.fpts + (r.settings.fpts_decimal || 0) / 100,
                fptsAgainst: (r.settings.fpts_against || 0) + (r.settings.fpts_against_decimal || 0) / 100,
                players: r.players || [], starters: r.starters || [],
                weeklyScores: scores
            };
        });

        teams.sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);
        teams.forEach((t, i) => t.standing = i + 1);

        const ctx = { tier, id, league: lg, users: us, rosters: ro, teams, state,
                      inSeason, currentWeek, completedWeeks, weeklyMatchups };
        _ctxCache[tier] = { t: Date.now(), ctx };
        return ctx;
    }

    async function allLeagueContexts() {
        const [a, b, c] = await Promise.all(TIER_ORDER.map(t => leagueContext(t)));
        return { top: a, mid: b, cellar: c };
    }

    // ── season history chain ────────────────────────────────────────────────
    // Walks previous_league_id back through every season of a tier.
    // CRITICAL: per-season attribution. Sleeper ties cumulative "franchise"
    // stats to the roster SLOT, which changes hands on promotion/relegation.
    // Each season's league object, however, stores that season's owner_id on
    // each roster — so records taken season-by-season are always credited to
    // the right human. Completed seasons never change → cached 30 days.
    async function tierHistory(tier) {
        const seasons = [];
        let id = LEAGUE_MAP[tier].id;
        for (let hop = 0; hop < 12 && id; hop++) {
            const lg = await cachedJSON(`${SLEEPER}/league/${id}`, hop === 0 ? 10 * MIN : 30 * DAY);
            const done = lg.status === 'complete';
            const ttl = done ? 30 * DAY : 10 * MIN;
            const [us, ro] = await Promise.all([
                cachedJSON(`${SLEEPER}/league/${id}/users`, ttl),
                cachedJSON(`${SLEEPER}/league/${id}/rosters`, ttl)
            ]);
            const teams = ro.map(r => {
                const u = us.find(x => x.user_id === r.owner_id);
                return {
                    ownerId: r.owner_id,
                    display: u?.display_name || 'Unknown',
                    avatar: u?.metadata?.avatar || u?.avatar || null, // that season's team logo
                    teamName: u?.metadata?.team_name || u?.display_name || `Roster ${r.roster_id}`,
                    rosterId: r.roster_id, division: r.settings.division || null,
                    wins: r.settings.wins || 0, losses: r.settings.losses || 0, ties: r.settings.ties || 0,
                    fpts: (r.settings.fpts || 0) + (r.settings.fpts_decimal || 0) / 100,
                    weekLog: r.metadata?.record || ''
                };
            });
            teams.sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);
            teams.forEach((t, i) => t.standing = i + 1);
            const bracket = done
                ? await cachedJSON(`${SLEEPER}/league/${id}/winners_bracket`, 30 * DAY).catch(() => null)
                : null;
            seasons.push({ season: +lg.season, leagueId: id, complete: done, teams, bracket });
            id = lg.previous_league_id;
        }
        return seasons; // newest first
    }

    // full season of matchups for a (usually historical) league — long cache
    async function seasonMatchups(id) {
        const weeks = Array.from({ length: 17 }, (_, i) => i + 1);
        return Promise.all(weeks.map(w =>
            cachedJSON(`${SLEEPER}/league/${id}/matchups/${w}`, 30 * DAY, `hm_${id}_${w}`).catch(() => [])));
    }

    async function allHistory() {
        const [a, b, c] = await Promise.all(TIER_ORDER.map(t => tierHistory(t)));
        return { top: a, mid: b, cellar: c };
    }

    return { nflState, playerMap, league, users, rosters, matchups, tradedPicks,
             winnersBracket, allTransactions, allMatchups, trending, fcValues,
             leagueContext, allLeagueContexts, tierHistory, allHistory, seasonMatchups };
})();

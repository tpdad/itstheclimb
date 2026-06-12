// ═════════════════════════════════════════════════════════════════════════
//  IT'S THE CLIMB — APPLICATION
//  Sections: HQ · Leagues · Dynasty · The Wire · Analytics · Trade Lab · Legacy
// ═════════════════════════════════════════════════════════════════════════

const APP = { section: 'hq', tier: 'top', wireTab: 'activity', legacyTab: 'records',
              labTier: 'top', labA: null, labB: null, labSelA: new Set(), labSelB: new Set() };

const $view = () => document.getElementById('view');

// ─── GENERIC HELPERS ─────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtVal = v => v >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(Math.round(v));
const fmtDate = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const avatarImg = (av, cls) => av
    ? `<img src="https://sleepercdn.com/avatars/thumbs/${av}" class="${cls} object-cover" loading="lazy">`
    : `<div class="${cls} flex items-center justify-center bg-white/5"><i class="fa-solid fa-shield-halved text-slate-600"></i></div>`;

function spinner(msg) {
    return `<div class="flex flex-col items-center py-24">
        <div class="w-10 h-10 border-2 border-white/10 border-t-[#E8C547] rounded-full animate-spin mb-4"></div>
        <p class="text-[11px] uppercase tracking-[0.25em] text-slate-500 mono animate-pulse">${esc(msg)}</p></div>`;
}
function errBox(msg) {
    return `<div class="panel rounded-xl p-6 text-center text-sm text-slate-400">
        <i class="fa-solid fa-cloud-bolt text-red-400 mr-2"></i>${esc(msg)}</div>`;
}

function sectionHead(kicker, title, sub) {
    return `<header class="mb-8">
        <p class="mono text-[10px] uppercase tracking-[0.35em] text-[#E8C547]/70 mb-2">${esc(kicker)}</p>
        <h2 class="display text-4xl sm:text-5xl lg:text-6xl uppercase leading-[0.95]">${title}</h2>
        ${sub ? `<p class="text-slate-400 text-sm mt-3 max-w-2xl">${sub}</p>` : ''}
    </header>`;
}

// sparkline SVG from numeric series
function sparkline(series, w = 120, h = 30, color = '#E8C547') {
    if (!series || series.length < 2) return '';
    const min = Math.min(...series), max = Math.max(...series), span = (max - min) || 1;
    const pts = series.map((v, i) => `${(i / (series.length - 1) * w).toFixed(1)},${(h - 3 - (v - min) / span * (h - 6)).toFixed(1)}`).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="overflow-visible">
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/></svg>`;
}

// ─── DYNASTY LOOKUPS (manual D-Score data) ──────────────────────────────────
function getDynastyInfo(user, teamName) {
    // 1) exact Sleeper user_id — immune to renames, apostrophes, second teams
    if (user?.user_id) {
        const byId = DYNASTY_RANKS.find(r => r.ownerId === user.user_id);
        if (byId) return byId;
    }
    // 2) fallback: fuzzy owner/team name match
    const norm = s => (s || '').toLowerCase().trim().replace(/[‘’‚‛′‵']/g, "'");
    const uName = norm(user?.display_name), tName = norm(teamName);
    return DYNASTY_RANKS.find(r => {
        const nt = norm(r.team);
        const isOwner = r.owners?.some(o => uName && (uName === o || uName.includes(o) || o.includes(uName)));
        const isTeam = tName && (tName === nt || tName.includes(nt) || nt.includes(tName));
        return isOwner || isTeam;
    });
}
const dynastySorted = () => [...DYNASTY_RANKS].sort((a, b) => b.score - a.score);
function getDynastyRankNum(info) {
    if (!info) return null;
    const i = dynastySorted().findIndex(d => d.team === info.team);
    return i === -1 ? null : i + 1;
}
const getImmunity = (teamName, display) => IMMUNITY_TEAMS_DATA.find(i =>
    i.team.toLowerCase() === (teamName || '').toLowerCase() || i.owner.toLowerCase() === (display || '').toLowerCase());

function badgesHTML(dyn, isChamp, isReleg) {
    let h = '<div class="flex flex-wrap gap-1 mt-2">';
    if (isChamp) { const c = RECORD_BADGES['Championship']; h += `<span class="badge ${c.bg} ${c.color}" title="Dynasty Champion"><i class="fa-solid ${c.icon}"></i></span>`; }
    if (dyn?.bonus && dyn.bonus !== '-') dyn.bonus.split(',').map(b => b.trim()).forEach(b => {
        if (b === 'Championship' || b === 'Relegation Risk') return;
        const c = RECORD_BADGES[b] || { icon: 'fa-medal', color: 'text-slate-400', bg: 'bg-slate-400/10' };
        h += `<span class="badge ${c.bg} ${c.color}" title="${esc(b)}"><i class="fa-solid ${c.icon}"></i></span>`;
    });
    if (dyn?.sloppyException) h += `<span class="badge bg-[#C97B4A]/15 text-[#C97B4A]" title="Sloppy Exception (Amendment X)"><i class="fa-solid fa-hat-cowboy"></i></span>`;
    if (isReleg) { const c = RECORD_BADGES['Relegation Risk']; h += `<span class="badge ${c.bg} ${c.color} releg-pulse" title="Relegation Risk"><i class="fa-solid ${c.icon}"></i></span>`; }
    return h + '</div>';
}

// ─── MARKET VALUE HELPERS (FantasyCalc) ─────────────────────────────────────
function rosterValue(playerIds, fc) {
    let total = 0; const valued = [];
    (playerIds || []).forEach(pid => {
        const e = fc.bySleeper[pid];
        if (e) { total += e.value; valued.push({ pid, e }); }
    });
    valued.sort((a, b) => b.e.value - a.e.value);
    return { total, valued };
}
function posGroups(valued) {
    const g = { QB: 0, RB: 0, WR: 0, TE: 0 };
    valued.forEach(({ e }) => { if (g[e.player.position] !== undefined) g[e.player.position] += e.value; });
    return g;
}
function avgRosterAge(valued) {
    // value-weighted age
    let wSum = 0, aSum = 0;
    valued.forEach(({ e }) => { if (e.player.maybeAge) { wSum += e.value; aSum += e.player.maybeAge * e.value; } });
    return wSum ? (aSum / wSum) : null;
}

// ─── NAVIGATION ─────────────────────────────────────────────────────────────
const SECTIONS = ['hq', 'leagues', 'dynasty', 'wire', 'analytics', 'lab', 'legacy'];
function go(section, opt) {
    APP.section = section;
    if (section === 'leagues' && opt) APP.tier = opt;
    if (section === 'wire' && opt) APP.wireTab = opt;
    if (section === 'legacy' && opt) APP.legacyTab = opt;
    document.querySelectorAll('[data-nav]').forEach(b =>
        b.classList.toggle('nav-active', b.dataset.nav === section));
    window.scrollTo({ top: 0 });
    render();
}

async function render() {
    const v = $view();
    try {
        switch (APP.section) {
            case 'hq':        return await renderHQ(v);
            case 'leagues':   return await renderLeague(v);
            case 'dynasty':   return await renderDynasty(v);
            case 'wire':      return await renderWire(v);
            case 'analytics': return await renderAnalytics(v);
            case 'lab':       return await renderLab(v);
            case 'legacy':    return renderLegacy(v);
        }
    } catch (e) {
        console.error(e);
        v.innerHTML = errBox('Data sync failed. Sleeper or FantasyCalc may be unreachable — try a refresh.');
    }
}

// ═════════════════════════════════════════════════════════════════════════
//  HQ — EXPEDITION DASHBOARD
// ═════════════════════════════════════════════════════════════════════════
async function renderHQ(v) {
    v.innerHTML = spinner('Surveying the mountain…');
    const [ctxs, fc] = await Promise.all([API.allLeagueContexts(), API.fcValues().catch(() => null)]);
    const pm = await API.playerMap();

    // latest transactions across all tiers (lightweight: current week only)
    let recent = [];
    try {
        const txs = await Promise.all(TIER_ORDER.map(async t => {
            const ctx = ctxs[t];
            const list = await API.allTransactions(ctx.id, Math.min(ctx.currentWeek, 3));
            return list.map(x => ({ ...x, tier: t, ctx }));
        }));
        recent = txs.flat().sort((a, b) => b.created - a.created).slice(0, 8);
    } catch (e) { /* non-fatal */ }

    const ds = DYNASTY_STATUS;
    const triggerBars = ds.triggers.map(t => `
        <div>
            <div class="flex justify-between text-[10px] mono text-slate-500 mb-1">
                <span class="truncate pr-2">${esc(t.label)}</span><span>${t.progress}/${t.total}</span>
            </div>
            <div class="h-1 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full ${t.color} rounded-full" style="width:${Math.round(t.progress / t.total * 100)}%"></div>
            </div>
        </div>`).join('');

    const tierCards = TIER_ORDER.map(t => {
        const ctx = ctxs[t], cfg = LEAGUE_MAP[t];
        const top3 = ctx.teams.slice(0, 3);
        const relegN = RELEGATION_RISK_COUNT[t], promoN = PROMOTION_SPOT_COUNT[t];
        const danger = relegN ? ctx.teams.slice(-relegN) : [];
        const promo = promoN ? ctx.teams.slice(0, promoN) : [];
        return `
        <div class="panel rounded-2xl overflow-hidden cursor-pointer hover:border-white/20 transition-all group" onclick="go('leagues','${t}')">
            <div class="px-5 pt-4 pb-3 border-b border-white/5" style="box-shadow: inset 0 3px 0 ${cfg.color}">
                <div class="flex justify-between items-baseline">
                    <h3 class="display text-xl uppercase group-hover:text-white transition-colors" style="color:${cfg.color}">${esc(cfg.name)}</h3>
                    <span class="mono text-[9px] tracking-[0.2em] text-slate-600">${esc(cfg.alt)}</span>
                </div>
            </div>
            <div class="p-5 space-y-2">
                ${top3.map(team => `
                    <div class="flex items-center gap-3">
                        <span class="mono text-[10px] w-4 text-slate-500">${team.standing}</span>
                        ${avatarImg(team.avatar, 'w-6 h-6 rounded')}
                        <span class="text-sm font-semibold truncate flex-1">${esc(team.name)}</span>
                        <span class="mono text-xs text-slate-400">${team.wins}-${team.losses}</span>
                    </div>`).join('')}
                ${danger.length ? `
                <div class="pt-2 mt-2 border-t border-white/5">
                    ${danger.map(team => `
                    <div class="flex items-center gap-3 opacity-80">
                        <span class="mono text-[10px] w-4 text-red-500">${team.standing}</span>
                        ${avatarImg(team.avatar, 'w-6 h-6 rounded')}
                        <span class="text-sm truncate flex-1 text-red-300/80">${esc(team.name)}</span>
                        <span class="text-[9px] mono uppercase text-red-500/80">releg zone</span>
                    </div>`).join('')}
                </div>` : ''}
                ${t !== 'top' && promo.length ? `
                <p class="text-[9px] mono uppercase tracking-widest text-emerald-500/70 pt-1">▲ ${promo.map(p => esc(p.name)).join(' · ')} climbing</p>` : ''}
            </div>
        </div>`;
    }).join('');

    const txRows = recent.length ? recent.map(t => txRowHTML(t, t.ctx, pm)).join('')
        : `<p class="text-sm text-slate-500 p-4">No recent activity. The mountain is quiet.</p>`;

    // market movers
    let movers = '';
    if (fc) {
        const rostered = new Set();
        TIER_ORDER.forEach(t => ctxs[t].teams.forEach(team => team.players.forEach(p => rostered.add(p))));
        const owned = fc.list.filter(e => e.player.sleeperId && rostered.has(e.player.sleeperId));
        const up = [...owned].sort((a, b) => b.trend30Day - a.trend30Day).slice(0, 5);
        const down = [...owned].sort((a, b) => a.trend30Day - b.trend30Day).slice(0, 5);
        const row = (e, dir) => `
            <div class="flex items-center gap-2 py-1.5">
                <span class="mono text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 w-8 text-center">${e.player.position}</span>
                <span class="text-sm flex-1 truncate">${esc(e.player.name)}</span>
                <span class="mono text-xs ${dir ? 'text-emerald-400' : 'text-red-400'}">${dir ? '+' : ''}${fmtVal(e.trend30Day)}</span>
            </div>`;
        movers = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="panel rounded-xl p-4">
                <p class="mono text-[9px] uppercase tracking-[0.25em] text-emerald-400/70 mb-2"><i class="fa-solid fa-arrow-trend-up mr-1"></i>Rising (30d, rostered in Climb)</p>
                ${up.map(e => row(e, true)).join('')}
            </div>
            <div class="panel rounded-xl p-4">
                <p class="mono text-[9px] uppercase tracking-[0.25em] text-red-400/70 mb-2"><i class="fa-solid fa-arrow-trend-down mr-1"></i>Falling (30d, rostered in Climb)</p>
                ${down.map(e => row(e, false)).join('')}
            </div>
        </div>`;
    }

    const seasonLabel = ctxs.top.inSeason
        ? `Week ${ctxs.top.currentWeek} · Live`
        : `${SEASON} Offseason · Season ${SEASON_NUM} ahead`;

    v.innerHTML = `
        ${sectionHead('Expedition HQ', `THE&nbsp;CLIMB <span class="text-slate-600">/</span> <span class="grad-gold">SEASON ${SEASON_NUM}</span>`, seasonLabel)}

        <!-- Dynasty victor banner -->
        <div class="panel-gold rounded-2xl p-5 mb-8">
            <div class="flex flex-col md:flex-row md:items-center gap-4">
                <div class="flex items-center gap-4 flex-1">
                    <div class="w-12 h-12 rounded-xl bg-[#E8C547]/10 border border-[#E8C547]/30 flex items-center justify-center text-[#E8C547] text-xl"><i class="fa-solid fa-mountain"></i></div>
                    <div>
                        <p class="mono text-[9px] uppercase tracking-[0.3em] text-slate-500">1st Dynasty · 2023–Present · Summit Leader</p>
                        <p class="display text-2xl uppercase grad-gold">${esc(ds.leader)}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="mono text-3xl font-bold text-[#E8C547]">${ds.leaderScore.toFixed(2)}</span>
                    <span class="block mono text-[9px] uppercase tracking-widest text-slate-600">D-Points</span>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">${triggerBars}</div>
        </div>

        <!-- Three tiers -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">${tierCards}</div>

        <!-- Activity + movers -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div class="panel rounded-2xl p-5">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="display text-lg uppercase">Latest Moves</h3>
                    <button onclick="go('wire')" class="mono text-[9px] uppercase tracking-widest text-[#E8C547]/80 hover:text-[#E8C547]">Full wire →</button>
                </div>
                <div class="divide-y divide-white/5">${txRows}</div>
            </div>
            <div>
                <h3 class="display text-lg uppercase mb-3 px-1">Market Watch</h3>
                ${movers || '<p class="text-sm text-slate-500">Market data unavailable.</p>'}
            </div>
        </div>`;
}

// ═════════════════════════════════════════════════════════════════════════
//  LEAGUES — TIER STANDINGS + LIVE MATCHUPS
// ═════════════════════════════════════════════════════════════════════════
async function renderLeague(v) {
    const tier = APP.tier, cfg = LEAGUE_MAP[tier];
    v.innerHTML = spinner(`Ascending to ${cfg.name}…`);
    const [ctx, fc] = await Promise.all([API.leagueContext(tier), API.fcValues().catch(() => null)]);

    const tierTabs = `<div class="flex gap-2 mb-8">${TIER_ORDER.map(t => `
        <button onclick="go('leagues','${t}')" class="pill ${t === tier ? 'pill-active' : ''}" ${t === tier ? `style="border-color:${LEAGUE_MAP[t].color};color:${LEAGUE_MAP[t].color}"` : ''}>
            ${esc(LEAGUE_MAP[t].name)}</button>`).join('')}</div>`;

    // live matchups
    let matchupsHTML = '';
    if (ctx.inSeason) {
        const wk = ctx.weeklyMatchups[ctx.currentWeek - 1] || [];
        const pairs = {};
        wk.forEach(m => { (pairs[m.matchup_id] = pairs[m.matchup_id] || []).push(m); });
        const cards = Object.values(pairs).filter(p => p.length === 2).map(([a, b]) => {
            const ta = ctx.teams.find(t => t.rosterId === a.roster_id), tb = ctx.teams.find(t => t.rosterId === b.roster_id);
            const aLead = a.points >= b.points;
            return `<div class="panel rounded-xl p-4">
                <div class="flex items-center gap-3 mb-2">
                    ${avatarImg(ta?.avatar, 'w-7 h-7 rounded')}
                    <span class="text-sm font-semibold flex-1 truncate ${aLead ? '' : 'text-slate-400'}">${esc(ta?.name || '?')}</span>
                    <span class="mono text-lg ${aLead ? 'text-[#E8C547]' : 'text-slate-400'}">${a.points.toFixed(1)}</span>
                </div>
                <div class="flex items-center gap-3">
                    ${avatarImg(tb?.avatar, 'w-7 h-7 rounded')}
                    <span class="text-sm font-semibold flex-1 truncate ${!aLead ? '' : 'text-slate-400'}">${esc(tb?.name || '?')}</span>
                    <span class="mono text-lg ${!aLead ? 'text-[#E8C547]' : 'text-slate-400'}">${b.points.toFixed(1)}</span>
                </div>
            </div>`;
        }).join('');
        if (cards) matchupsHTML = `
            <section class="mb-10">
                <h3 class="display text-xl uppercase mb-4 flex items-center gap-3">
                    <span class="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>Week ${ctx.currentWeek} Scoreboard</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
            </section>`;
    } else {
        matchupsHTML = `<div class="panel rounded-xl p-4 mb-10 flex items-center gap-3 text-sm text-slate-400">
            <i class="fa-solid fa-snowflake text-sky-300/60"></i>
            Offseason — the ${SEASON} expedition hasn't kicked off. Standings show last synced state; roster values below are live.</div>`;
    }

    // relegation zone ids
    const relegN = RELEGATION_RISK_COUNT[tier];
    const relegIds = new Set(relegN ? ctx.teams.slice(-relegN).map(t => t.rosterId) : []);

    // market rank within tier
    let valueByRoster = {};
    if (fc) ctx.teams.forEach(t => { valueByRoster[t.rosterId] = rosterValue(t.players, fc).total; });
    const valueRanks = Object.entries(valueByRoster).sort((a, b) => b[1] - a[1]).map(e => +e[0]);

    const cards = ctx.teams.map(team => {
        const dyn = getDynastyInfo(team.user, team.name);
        const isChamp = dyn && CHAMPION_TEAMS.includes(dyn.team);
        const isReleg = relegIds.has(team.rosterId);
        const dynRank = getDynastyRankNum(dyn);
        const gold = dynRank === 1 && tier === 'top';
        const imm = getImmunity(team.name, team.display);
        const mv = valueByRoster[team.rosterId];
        const mvRank = mv !== undefined ? valueRanks.indexOf(team.rosterId) + 1 : null;
        const spark = team.weeklyScores.length > 2 ? sparkline(team.weeklyScores, 90, 24, cfg.color) : '';
        return `
        <div class="panel ${gold ? 'panel-gold' : ''} rounded-2xl p-5 cursor-pointer hover:-translate-y-0.5 hover:border-white/20 transition-all"
             onclick="openTeam('${tier}',${team.rosterId})" style="${gold ? '' : `box-shadow: inset 0 3px 0 ${cfg.color}33`}">
            <div class="flex justify-between items-start mb-3">
                <div class="flex gap-3 items-center min-w-0">
                    ${avatarImg(team.avatar, 'w-11 h-11 rounded-lg flex-shrink-0')}
                    <div class="min-w-0">
                        <h4 class="display text-base uppercase truncate ${gold ? 'grad-gold' : ''}">${esc(team.name)}</h4>
                        <p class="mono text-[9px] text-slate-500 uppercase truncate">@${esc(team.display)} · est ${dyn?.entered || '—'}</p>
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <span class="display text-2xl ${gold ? 'text-[#E8C547]' : ''}">#${team.standing}</span>
                </div>
            </div>
            ${badgesHTML(dyn, isChamp, isReleg)}
            <div class="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-white/5">
                <div><span class="stat-label">W-L</span><span class="stat-num">${team.wins}-${team.losses}</span></div>
                <div><span class="stat-label">PF</span><span class="stat-num">${Math.round(team.fpts)}</span></div>
                <div><span class="stat-label">D-Score</span><span class="stat-num ${dyn ? (dyn.score < 0 ? 'text-red-400' : 'text-[#E8C547]') : 'text-slate-500'}">${dyn ? dyn.score.toFixed(0) : '—'}</span></div>
                <div><span class="stat-label">Mkt Val</span><span class="stat-num text-sky-300">${mv !== undefined ? fmtVal(mv) : '—'}${mvRank ? `<i class="text-[8px] text-slate-500 not-italic"> #${mvRank}</i>` : ''}</span></div>
            </div>
            <div class="flex justify-between items-end mt-2">
                ${spark ? `<div>${spark}<span class="stat-label mt-0.5">weekly pts</span></div>` : '<span></span>'}
                ${imm ? `<span class="immunity-tag" title="${esc(imm.reason)} · expires ${imm.expires}"><i class="fa-solid fa-crown mr-1"></i>IMMUNE '${String(imm.expires).slice(-2)}</span>` : ''}
            </div>
        </div>`;
    }).join('');

    v.innerHTML = `
        ${sectionHead(cfg.alt, `<span style="color:${cfg.color}">${esc(cfg.name).toUpperCase()}</span>`, `${esc(cfg.subtitle)} · ${cfg.capacity} teams`)}
        ${tierTabs}
        ${matchupsHTML}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">${cards}</div>`;
}

// ═════════════════════════════════════════════════════════════════════════
//  TEAM MODAL — ROSTER + MARKET INTELLIGENCE
// ═════════════════════════════════════════════════════════════════════════
async function openTeam(tier, rosterId) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    modal.classList.remove('hidden'); document.body.classList.add('modal-open');
    body.innerHTML = spinner('Scouting roster…');

    const [ctx, fc, pm] = await Promise.all([API.leagueContext(tier), API.fcValues().catch(() => null), API.playerMap()]);
    const team = ctx.teams.find(t => t.rosterId === rosterId);
    if (!team) { body.innerHTML = errBox('Team not found.'); return; }

    const dyn = getDynastyInfo(team.user, team.name);
    const dynRank = getDynastyRankNum(dyn);
    const imm = getImmunity(team.name, team.display);
    const cfg = LEAGUE_MAP[tier];

    let marketHTML = '', rosterHTML = '';
    if (fc) {
        const { total, valued } = rosterValue(team.players, fc);
        const groups = posGroups(valued);
        const age = avgRosterAge(valued);
        const leagueTotals = ctx.teams.map(t => rosterValue(t.players, fc).total);
        const maxTotal = Math.max(...leagueTotals);
        const rank = [...leagueTotals].sort((a, b) => b - a).indexOf(total) + 1;
        const maxPos = Math.max(...Object.values(groups), 1);
        const posBar = (pos, color) => `
            <div class="flex items-center gap-2">
                <span class="mono text-[9px] w-6 ${color}">${pos}</span>
                <div class="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${color}" style="width:${Math.round(groups[pos] / maxPos * 100)}%;background:currentColor"></div>
                </div>
                <span class="mono text-[10px] text-slate-400 w-10 text-right">${fmtVal(groups[pos])}</span>
            </div>`;
        marketHTML = `
            <div class="panel rounded-xl p-4 space-y-3">
                <div class="flex justify-between items-baseline">
                    <span class="stat-label">Roster Market Value</span>
                    <span class="mono text-[9px] text-slate-500">#${rank} of ${ctx.teams.length} in tier</span>
                </div>
                <div class="flex items-end gap-3">
                    <span class="display text-3xl text-sky-300">${fmtVal(total)}</span>
                    ${age ? `<span class="mono text-[10px] text-slate-500 pb-1">value-weighted age ${age.toFixed(1)}</span>` : ''}
                </div>
                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full bg-sky-400 rounded-full" style="width:${Math.round(total / maxTotal * 100)}%"></div>
                </div>
                <div class="space-y-1.5 pt-2 text-sky-300">
                    ${posBar('QB', 'text-red-400')}${posBar('RB', 'text-emerald-400')}${posBar('WR', 'text-sky-400')}${posBar('TE', 'text-orange-400')}
                </div>
                <p class="mono text-[8px] text-slate-600 uppercase tracking-widest pt-1">Source: FantasyCalc dynasty SF values · 6h refresh</p>
            </div>`;

        const posColor = { QB: 'text-red-400', RB: 'text-emerald-400', WR: 'text-sky-400', TE: 'text-orange-400' };
        rosterHTML = valued.map(({ pid, e }) => {
            const p = pm[pid];
            const trend = e.trend30Day;
            return `<div class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span class="mono text-[9px] w-7 ${posColor[e.player.position] || 'text-slate-400'}">${e.player.position}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold truncate">${esc(e.player.name)}</p>
                    <p class="mono text-[9px] text-slate-500">${p?.team || e.player.maybeTeam || 'FA'} · ${e.player.maybeAge ? e.player.maybeAge.toFixed(0) + 'y' : ''} · ovr #${e.overallRank}</p>
                </div>
                <span class="mono text-[10px] ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-500'}">${trend > 0 ? '▲' : trend < 0 ? '▼' : ''}${fmtVal(Math.abs(trend))}</span>
                <span class="mono text-sm text-sky-300 w-12 text-right">${fmtVal(e.value)}</span>
            </div>`;
        }).join('');
        // unvalued depth pieces
        const unvalued = team.players.filter(pid => !fc.bySleeper[pid] && pm[pid] && !['DEF','K'].includes(pm[pid].position));
        if (unvalued.length) rosterHTML += `<p class="mono text-[9px] text-slate-600 pt-3 uppercase tracking-widest">+ ${unvalued.length} depth pieces below market threshold</p>`;
    } else {
        rosterHTML = team.players.map(pid => {
            const p = pm[pid]; if (!p) return '';
            return `<div class="py-1.5 text-sm">${esc(p.first_name + ' ' + p.last_name)} <span class="mono text-[9px] text-slate-500">${p.position} · ${p.team || 'FA'}</span></div>`;
        }).join('');
    }

    const dscoreHTML = dyn?.breakdown ? `
        <div class="panel rounded-xl p-4">
            <div class="flex justify-between items-center mb-2">
                <span class="stat-label">Dynasty Score</span>
                ${dynRank ? `<span class="mono text-[9px] px-2 py-0.5 rounded bg-[#E8C547]/10 text-[#E8C547]">D-#${dynRank}</span>` : ''}
            </div>
            <span class="display text-3xl ${dyn.score < 0 ? 'text-red-400' : 'text-[#E8C547]'}">${dyn.score.toFixed(2)}</span>
            <div class="mt-3 pt-2 border-t border-white/5 space-y-1">
                ${DSCORE_LINE_ITEMS.filter(li => dyn.breakdown[li.key]).map(li => {
                    const val = dyn.breakdown[li.key];
                    const neg = li.key === 'relegated' || li.key === 'bottom4';
                    return `<div class="flex justify-between"><span class="mono text-[9px] text-slate-500">${li.label}</span>
                        <span class="mono text-[9px] ${neg ? 'text-red-400' : 'text-slate-300'}">${li.key === 'winPct' ? val + '%' : '×' + val}</span></div>`;
                }).join('')}
            </div>
        </div>` : '';

    body.innerHTML = `
        <div class="flex items-start gap-4 mb-6">
            ${avatarImg(team.avatar, 'w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex-shrink-0')}
            <div class="flex-1 min-w-0">
                <p class="mono text-[9px] uppercase tracking-[0.3em]" style="color:${cfg.color}">${esc(cfg.name)} · #${team.standing}</p>
                <h2 class="display text-2xl sm:text-3xl uppercase leading-tight">${esc(team.name)}</h2>
                <p class="mono text-[10px] text-slate-500">@${esc(team.display)} · est ${dyn?.entered || '—'} · ${team.wins}-${team.losses} · ${Math.round(team.fpts)} PF</p>
                ${badgesHTML(dyn, dyn && CHAMPION_TEAMS.includes(dyn.team), false)}
            </div>
        </div>
        ${imm ? `<div class="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 mb-4 text-xs text-emerald-300">
            <i class="fa-solid fa-crown mr-2"></i>${esc(imm.reason)} — immune from relegation through ${imm.expires}</div>` : ''}
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div class="md:col-span-2 space-y-4">${marketHTML}${dscoreHTML}</div>
            <div class="md:col-span-3 panel rounded-xl p-4">
                <p class="stat-label mb-2">Roster by Market Value</p>
                <div class="max-h-[26rem] overflow-y-auto pr-1">${rosterHTML}</div>
            </div>
        </div>`;
}
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// ═════════════════════════════════════════════════════════════════════════
//  DYNASTY — D-SCORE + MARKET VALUE
// ═════════════════════════════════════════════════════════════════════════
async function renderDynasty(v) {
    const sub = APP.dynastyTab || 'official';
    const subTabs = `<div class="flex gap-2 mb-8">
        <button onclick="APP.dynastyTab='official';render()" class="pill ${sub === 'official' ? 'pill-active' : ''}">Official Rankings</button>
        <button onclick="APP.dynastyTab='audit';render()" class="pill ${sub === 'audit' ? 'pill-active' : ''}"><i class="fa-solid fa-calculator mr-1"></i>Auto-Audit</button>
    </div>`;
    if (sub === 'audit') return renderDScoreAudit(v, subTabs);

    v.innerHTML = spinner('Computing the standings of history…');
    let fc = null, ctxs = null;
    try { [fc, ctxs] = await Promise.all([API.fcValues(), API.allLeagueContexts()]); } catch (e) { /* manual table still renders */ }

    // map dynasty team -> live market value (search all tiers)
    const mvByTeam = {};
    if (fc && ctxs) TIER_ORDER.forEach(t => ctxs[t].teams.forEach(team => {
        const dyn = getDynastyInfo(team.user, team.name);
        if (dyn) mvByTeam[dyn.team] = { mv: rosterValue(team.players, fc).total, tier: t };
    }));

    const rows = dynastySorted().map((item, i) => {
        const isChamp = CHAMPION_TEAMS.includes(item.team);
        const scoreCls = item.score < 0 ? 'text-red-400' : i === 0 ? 'text-[#E8C547]' : 'text-white';
        const mv = mvByTeam[item.team];
        return `<tr class="border-b border-white/5 hover:bg-white/5 transition-colors ${i === 0 ? 'bg-[#E8C547]/5' : ''}">
            <td class="p-3 sm:p-4 display text-xl ${i === 0 ? 'text-[#E8C547]' : 'text-slate-400'}">${i + 1}</td>
            <td class="p-3 sm:p-4">
                <p class="font-bold uppercase tracking-tight text-sm ${i === 0 ? 'grad-gold' : ''}">${esc(item.team)}</p>
                <p class="mono text-[9px] text-slate-600">est ${item.entered || '—'}${mv ? ` · ${esc(LEAGUE_MAP[mv.tier].name)}` : ''}</p>
            </td>
            <td class="p-3 sm:p-4 mono text-xs text-slate-400">${item.winPct}</td>
            <td class="p-3 sm:p-4 mono font-bold ${scoreCls}">${item.score.toFixed(2)}</td>
            <td class="p-3 sm:p-4 mono text-xs text-sky-300 hidden sm:table-cell">${mv ? fmtVal(mv.mv) : '—'}</td>
            <td class="p-3 sm:p-4 hidden md:table-cell">${badgesHTML(item, isChamp, false)}</td>
        </tr>`;
    }).join('');

    v.innerHTML = `
        ${sectionHead('The Standings of History', 'DYNASTY <span class="grad-gold">RANKINGS</span>',
            'D-Score is the league\u2019s own scoring of dynasty achievement (Amendment I). Market value is each roster\u2019s live FantasyCalc dynasty valuation — past glory vs. present arsenal.')}
        ${subTabs}
        <div class="panel rounded-2xl overflow-hidden">
            <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead><tr class="bg-white/5 mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
                    <th class="p-3 sm:p-4">#</th><th class="p-3 sm:p-4">Team</th><th class="p-3 sm:p-4">Win%</th>
                    <th class="p-3 sm:p-4">D-Score</th><th class="p-3 sm:p-4 hidden sm:table-cell">Mkt Val</th><th class="p-3 sm:p-4 hidden md:table-cell">Honors</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            </div>
        </div>`;
}

// ── AUTO-AUDIT: computed D-Scores vs the commissioner's books ───────────────
async function renderDScoreAudit(v, subTabs) {
    v.innerHTML = spinner('Auditing the books…');
    const hist = await API.allHistory();
    const computed = computeDScores(hist);

    const rows = dynastySorted().map(item => {
        const c = computed[item.ownerId];
        if (!c) return `<tr class="border-b border-white/5"><td class="p-3" colspan="5">
            <span class="text-sm">${esc(item.team)}</span> <span class="mono text-[9px] text-slate-600">no Sleeper history found</span></td></tr>`;
        const delta = c.total - item.score;
        const dCls = Math.abs(delta) < 1 ? 'text-emerald-400' : Math.abs(delta) < 25 ? 'text-yellow-400' : 'text-red-400';
        const rid = item.ownerId;
        const detail = AUDIT_ITEMS.map(a => {
            const auto = c.comp[a.key] || 0;
            const man = item.breakdown?.[a.manual] || 0;
            if (!auto && !man) return '';
            const same = auto === man;
            return `<div class="flex justify-between items-center py-0.5">
                <span class="mono text-[9px] text-slate-500">${a.label}</span>
                <span class="mono text-[9px] ${same ? 'text-slate-300' : 'text-yellow-400'}">${auto}${same ? '' : ` <span class="text-slate-600">(book: ${man})</span>`}</span>
            </div>`;
        }).join('');
        return `<tr class="border-b border-white/5 hover:bg-white/5 cursor-pointer" onclick="document.getElementById('aud-${rid}').classList.toggle('hidden')">
            <td class="p-3"><p class="text-sm font-bold uppercase">${esc(item.team)}</p>
                <p class="mono text-[9px] text-slate-600">avg win% ${c.avgWinPct.toFixed(1)} · record bonuses ${c.manualBonus}</p></td>
            <td class="p-3 mono text-sm">${item.score.toFixed(2)}</td>
            <td class="p-3 mono text-sm text-sky-300">${c.total.toFixed(2)}</td>
            <td class="p-3 mono text-sm font-bold ${dCls}">${delta >= 0 ? '+' : ''}${delta.toFixed(2)}</td>
            <td class="p-3 text-right"><i class="fa-solid fa-chevron-down text-[10px] text-slate-600"></i></td>
        </tr>
        <tr id="aud-${rid}" class="hidden bg-black/20"><td colspan="5" class="p-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8">${detail}</div>
        </td></tr>`;
    }).join('');

    v.innerHTML = `
        ${sectionHead('The Commissioner\u2019s Audit', 'D-SCORE <span class="grad-gold">AUTO-AUDIT</span>',
            'Every Amendment I component computed live from Sleeper history — championships and playoff wins from brackets, points titles from scoring, relegations from cross-season movement. Compare against the official books; yellow components disagree. Record-holder bonuses and adjustments stay manual. Your spreadsheet is now a one-click audit.')}
        ${subTabs}
        <div class="panel rounded-2xl overflow-hidden"><div class="overflow-x-auto">
        <table class="w-full text-left">
            <thead><tr class="bg-white/5 mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
                <th class="p-3">Team</th><th class="p-3">Official</th><th class="p-3">Computed</th><th class="p-3">\u0394</th><th class="p-3"></th>
            </tr></thead><tbody>${rows}</tbody>
        </table></div></div>
        <p class="mono text-[9px] text-slate-600 uppercase tracking-widest mt-3">Computed = components \u00d7 Amendment I points + avg win% + record bonuses (manual) \u00b7 click a row for the component-by-component comparison</p>`;
}

// ═════════════════════════════════════════════════════════════════════════
//  THE WIRE — AUTO TRANSACTIONS + TRENDING
// ═════════════════════════════════════════════════════════════════════════
function txRowHTML(t, ctx, pm) {
    const teamOf = rid => ctx.teams.find(x => x.rosterId === rid)?.name || `Roster ${rid}`;
    const pName = pid => pm[pid] ? `${pm[pid].first_name} ${pm[pid].last_name}` : `#${pid}`;
    const tierCfg = LEAGUE_MAP[t.tier || ctx.tier];
    const tierDot = `<span class="w-1.5 h-1.5 rounded-full inline-block mr-1" style="background:${tierCfg.color}"></span>`;

    if (t.type === 'trade') {
        const sides = {};
        (t.roster_ids || []).forEach(rid => sides[rid] = { gets: [] });
        Object.entries(t.adds || {}).forEach(([pid, rid]) => sides[rid]?.gets.push(pName(pid)));
        (t.draft_picks || []).forEach(p => sides[p.owner_id]?.gets.push(`${p.season} R${p.round}`));
        const desc = Object.entries(sides).map(([rid, s]) =>
            `<span class="text-slate-200 font-semibold">${esc(teamOf(+rid))}</span> <span class="text-slate-500">gets</span> ${esc(s.gets.join(', ') || '—')}`).join(' <span class="text-slate-600">·</span> ');
        return `<div class="py-2.5 text-xs leading-relaxed">
            <span class="tx-tag bg-purple-400/10 text-purple-300">${tierDot}TRADE</span>
            <span class="mono text-[9px] text-slate-600 ml-1">wk${t.leg} · ${fmtDate(t.created)}</span>
            <div class="mt-1">${desc}</div></div>`;
    }
    const team = teamOf((t.roster_ids || [])[0]);
    const adds = Object.keys(t.adds || {}).map(pName);
    const drops = Object.keys(t.drops || {}).map(pName);
    const isWaiver = t.type === 'waiver';
    return `<div class="py-2.5 text-xs leading-relaxed">
        <span class="tx-tag ${isWaiver ? 'bg-sky-400/10 text-sky-300' : 'bg-emerald-400/10 text-emerald-300'}">${tierDot}${isWaiver ? 'WAIVER' : 'FA'}</span>
        <span class="mono text-[9px] text-slate-600 ml-1">wk${t.leg} · ${fmtDate(t.created)}</span>
        <div class="mt-1"><span class="text-slate-200 font-semibold">${esc(team)}</span>
            ${adds.length ? `<span class="text-emerald-400"> +${esc(adds.join(', '))}</span>` : ''}
            ${drops.length ? `<span class="text-red-400/80"> −${esc(drops.join(', '))}</span>` : ''}
        </div></div>`;
}

async function renderWire(v) {
    v.innerHTML = spinner('Tapping the wire…');
    const tabs = `<div class="flex gap-2 mb-8">
        <button onclick="go('wire','activity')" class="pill ${APP.wireTab === 'activity' ? 'pill-active' : ''}">League Activity</button>
        <button onclick="go('wire','trending')" class="pill ${APP.wireTab === 'trending' ? 'pill-active' : ''}">Trending / Available</button>
    </div>`;

    if (APP.wireTab === 'trending') {
        const [ctxs, pm, adds, drops, fc] = await Promise.all([
            API.allLeagueContexts(), API.playerMap(),
            API.trending('add'), API.trending('drop'), API.fcValues().catch(() => null)]);
        const rosteredByTier = {};
        TIER_ORDER.forEach(t => {
            rosteredByTier[t] = new Set();
            ctxs[t].teams.forEach(team => team.players.forEach(p => rosteredByTier[t].add(p)));
        });
        const row = (e, isAdd) => {
            const p = pm[e.player_id]; if (!p) return '';
            const avail = TIER_ORDER.filter(t => !rosteredByTier[t].has(e.player_id));
            const val = fc?.bySleeper[e.player_id];
            return `<div class="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                <span class="mono text-[9px] w-7 text-slate-400">${p.position}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold truncate">${esc(p.first_name + ' ' + p.last_name)} <span class="mono text-[9px] text-slate-500">${p.team || 'FA'}</span></p>
                    <p class="mono text-[9px] ${avail.length ? 'text-emerald-400/80' : 'text-slate-600'}">
                        ${avail.length ? 'available: ' + avail.map(t => LEAGUE_MAP[t].name.replace('The ', '')).join(', ') : 'rostered in all tiers'}</p>
                </div>
                ${val ? `<span class="mono text-[10px] text-sky-300">${fmtVal(val.value)}</span>` : ''}
                <span class="mono text-xs ${isAdd ? 'text-emerald-400' : 'text-red-400'}">${isAdd ? '+' : '−'}${e.count.toLocaleString()}</span>
            </div>`;
        };
        v.innerHTML = `
            ${sectionHead('The Wire', 'TRENDING <span class="grad-gold">PLAYERS</span>',
                'Hottest adds and drops across all of Sleeper (last 48h), cross-checked against Climb rosters — green means somebody in this league can still grab them.')}
            ${tabs}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div class="panel rounded-2xl p-5"><h3 class="display text-lg uppercase mb-2 text-emerald-400">Most Added</h3>${adds.map(e => row(e, true)).join('')}</div>
                <div class="panel rounded-2xl p-5"><h3 class="display text-lg uppercase mb-2 text-red-400">Most Dropped</h3>${drops.map(e => row(e, false)).join('')}</div>
            </div>`;
        return;
    }

    // activity: full auto transaction log across tiers
    const [ctxs, pm] = await Promise.all([API.allLeagueContexts(), API.playerMap()]);
    const all = (await Promise.all(TIER_ORDER.map(async t => {
        const ctx = ctxs[t];
        const list = await API.allTransactions(ctx.id, ctx.inSeason ? ctx.currentWeek : 1);
        return list.map(x => ({ ...x, tier: t, ctx }));
    }))).flat().sort((a, b) => b.created - a.created);

    window._wireData = { all, pm }; // for filter re-render
    renderWireList('all', 'all');

    function buildShell(listHTML, counts) {
        const fbtn = (key, label, n) => `<button onclick="filterWire('${key}')" data-wf="${key}"
            class="pill ${key === 'all' ? 'pill-active' : ''}">${label} <span class="mono text-[9px] text-slate-500">${n}</span></button>`;
        v.innerHTML = `
            ${sectionHead('The Wire', 'LEAGUE <span class="grad-gold">ACTIVITY</span>',
                'Every trade, waiver claim, and free-agent move across all three tiers — pulled live from Sleeper. No more manual logs.')}
            ${tabs}
            <div class="flex flex-wrap gap-2 mb-5">
                ${fbtn('all', 'All', counts.all)}${fbtn('trade', 'Trades', counts.trade)}
                ${fbtn('waiver', 'Waivers', counts.waiver)}${fbtn('free_agent', 'Free Agents', counts.fa)}
                <span class="flex-1"></span>
                ${TIER_ORDER.map(t => `<button onclick="filterWireTier('${t}')" data-wt="${t}" class="pill" style="color:${LEAGUE_MAP[t].color}">${LEAGUE_MAP[t].name.replace('The ', '')}</button>`).join('')}
            </div>
            <div class="panel rounded-2xl p-5"><div id="wire-list" class="divide-y divide-white/5">${listHTML}</div></div>`;
    }

    function renderWireList(typeF, tierF) {
        window._wireFilter = { typeF, tierF };
        const filtered = all.filter(t =>
            (typeF === 'all' || t.type === typeF) && (tierF === 'all' || t.tier === tierF)).slice(0, 150);
        const listHTML = filtered.length ? filtered.map(t => txRowHTML(t, t.ctx, pm)).join('')
            : '<p class="text-sm text-slate-500 py-6 text-center">No transactions match.</p>';
        const counts = { all: all.length, trade: all.filter(t => t.type === 'trade').length,
                         waiver: all.filter(t => t.type === 'waiver').length, fa: all.filter(t => t.type === 'free_agent').length };
        if (!document.getElementById('wire-list')) buildShell(listHTML, counts);
        else document.getElementById('wire-list').innerHTML = listHTML;
        document.querySelectorAll('[data-wf]').forEach(b => b.classList.toggle('pill-active', b.dataset.wf === typeF));
        document.querySelectorAll('[data-wt]').forEach(b => b.classList.toggle('pill-active', b.dataset.wt === tierF));
    }
    window.filterWire = key => renderWireList(key, window._wireFilter?.tierF || 'all');
    window.filterWireTier = t => {
        const cur = window._wireFilter || { typeF: 'all', tierF: 'all' };
        renderWireList(cur.typeF, cur.tierF === t ? 'all' : t);
    };
}

// ═════════════════════════════════════════════════════════════════════════
//  ANALYTICS — POWER, TRENDS, ODDS
// ═════════════════════════════════════════════════════════════════════════
async function renderAnalytics(v) {
    v.innerHTML = spinner('Running the numbers…');
    const tier = APP.tier;
    const [ctx, fc] = await Promise.all([API.leagueContext(tier), API.fcValues().catch(() => null)]);
    const cfg = LEAGUE_MAP[tier];

    const tierTabs = `<div class="flex gap-2 mb-8">${TIER_ORDER.map(t => `
        <button onclick="APP.tier='${t}';render()" class="pill ${t === tier ? 'pill-active' : ''}">${esc(LEAGUE_MAP[t].name)}</button>`).join('')}</div>`;

    let content = '';
    if (ctx.inSeason && ctx.completedWeeks >= 2) {
        // ── ALL-PLAY POWER RANKINGS ─────────────────────────────────────────
        const power = ctx.teams.map(team => {
            let apW = 0, apG = 0;
            for (let w = 0; w < ctx.completedWeeks; w++) {
                const wk = ctx.weeklyMatchups[w] || [];
                const mine = wk.find(m => m.roster_id === team.rosterId);
                if (!mine) continue;
                wk.forEach(m => { if (m.roster_id !== team.rosterId) { apG++; if (mine.points > m.points) apW++; } });
            }
            const recent = team.weeklyScores.slice(-3);
            const form = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
            const avg = team.weeklyScores.length ? team.weeklyScores.reduce((a, b) => a + b, 0) / team.weeklyScores.length : 0;
            return { team, apPct: apG ? apW / apG : 0, form, avg };
        });
        const maxForm = Math.max(...power.map(p => p.form), 1);
        power.forEach(p => p.score = p.apPct * 70 + (p.form / maxForm) * 30);
        power.sort((a, b) => b.score - a.score);

        // ── MONTE CARLO PLAYOFF / RELEGATION ODDS ───────────────────────────
        const odds = await monteCarloOdds(ctx);

        const rows = power.map((p, i) => {
            const o = odds[p.team.rosterId] || {};
            return `<tr class="border-b border-white/5 hover:bg-white/5">
                <td class="p-3 display text-lg text-slate-400">${i + 1}</td>
                <td class="p-3"><div class="flex items-center gap-2">${avatarImg(p.team.avatar, 'w-7 h-7 rounded')}
                    <div><p class="text-sm font-semibold">${esc(p.team.name)}</p>
                    <p class="mono text-[9px] text-slate-600">${p.team.wins}-${p.team.losses} · avg ${p.avg.toFixed(1)}</p></div></div></td>
                <td class="p-3 mono text-xs">${(p.apPct * 100).toFixed(0)}%</td>
                <td class="p-3 mono text-xs">${p.form.toFixed(1)}</td>
                <td class="p-3">${sparkline(p.team.weeklyScores, 80, 22, cfg.color)}</td>
                <td class="p-3 mono text-xs ${o.playoff > 0.5 ? 'text-emerald-400' : 'text-slate-400'}">${o.playoff !== undefined ? (o.playoff * 100).toFixed(0) + '%' : '—'}</td>
                <td class="p-3 mono text-xs ${o.releg > 0.25 ? 'text-red-400' : 'text-slate-500'}">${o.releg !== undefined ? (o.releg * 100).toFixed(0) + '%' : '—'}</td>
            </tr>`;
        }).join('');

        content = `
        <div class="panel rounded-2xl overflow-hidden">
            <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead><tr class="bg-white/5 mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
                    <th class="p-3">Pwr</th><th class="p-3">Team</th><th class="p-3" title="If you played every team every week">All-Play</th>
                    <th class="p-3">Form (3wk)</th><th class="p-3">Trend</th><th class="p-3">Playoff%</th><th class="p-3">Releg%</th>
                </tr></thead><tbody>${rows}</tbody>
            </table></div>
        </div>
        <p class="mono text-[9px] text-slate-600 uppercase tracking-widest mt-3">Power = 70% all-play win rate + 30% recent form · Odds = 2,000-season Monte Carlo on remaining schedule (record only — division byes & scoring bumps not modeled)</p>`;
    } else {
        // ── PRESEASON: MARKET-BASED OUTLOOK ────────────────────────────────
        if (!fc) { content = errBox('Market data unavailable for preseason outlook.'); }
        else {
            const rated = ctx.teams.map(team => {
                const { total, valued } = rosterValue(team.players, fc);
                const age = avgRosterAge(valued);
                const top5 = valued.slice(0, 5);
                return { team, total, age, top5 };
            }).sort((a, b) => b.total - a.total);
            const maxV = rated[0]?.total || 1;
            const median = rated[Math.floor(rated.length / 2)]?.total || 1;
            const rows = rated.map((r, i) => {
                const status = r.total > median * 1.15 ? ['CONTENDER', 'text-emerald-400'] :
                               r.total < median * 0.85 ? ['REBUILDING', 'text-red-400'] : ['IN THE HUNT', 'text-slate-300'];
                return `<div class="panel rounded-xl p-4 flex items-center gap-4">
                    <span class="display text-2xl w-8 ${i === 0 ? 'text-[#E8C547]' : 'text-slate-500'}">${i + 1}</span>
                    ${avatarImg(r.team.avatar, 'w-9 h-9 rounded-lg')}
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate">${esc(r.team.name)}</p>
                        <p class="mono text-[9px] text-slate-500 truncate">${r.top5.map(x => x.e.player.name.split(' ').slice(-1)[0]).join(' · ')}</p>
                        <div class="h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                            <div class="h-full rounded-full" style="width:${Math.round(r.total / maxV * 100)}%;background:${cfg.color}"></div>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <span class="mono text-sm text-sky-300 block">${fmtVal(r.total)}</span>
                        <span class="mono text-[8px] uppercase tracking-widest ${status[1]}">${status[0]}</span>
                        ${r.age ? `<span class="mono text-[8px] text-slate-600 block">age ${r.age.toFixed(1)}</span>` : ''}
                    </div>
                </div>`;
            }).join('');
            content = `
                <div class="panel rounded-xl p-4 mb-5 text-sm text-slate-400 flex items-center gap-3">
                    <i class="fa-solid fa-binoculars text-[#E8C547]/70"></i>
                    Preseason outlook — power rankings, all-play records, and playoff odds activate automatically once Week 1 kicks off. Until then: the market's view of every arsenal.</div>
                <div class="grid grid-cols-1 gap-3">${rows}</div>`;
        }
    }

    v.innerHTML = `
        ${sectionHead('The Numbers', `ANALYTICS <span style="color:${cfg.color}">· ${esc(cfg.name.replace('The ', '').toUpperCase())}</span>`,
            ctx.inSeason ? `Through week ${ctx.completedWeeks} · ${SEASON}` : `${SEASON} preseason · market-based outlook`)}
        ${tierTabs}${content}`;
}

async function monteCarloOdds(ctx) {
    const out = {};
    try {
        const REG_END = 14, SIMS = 2000;
        const future = [];
        const all = await API.allMatchups(ctx.id, REG_END);
        for (let w = ctx.currentWeek; w <= REG_END; w++) {
            const wk = all[w - 1] || [], pairs = {};
            wk.forEach(m => { (pairs[m.matchup_id] = pairs[m.matchup_id] || []).push(m.roster_id); });
            Object.values(pairs).forEach(p => { if (p.length === 2) future.push(p); });
        }
        if (!future.length) return out;
        const stats = {};
        ctx.teams.forEach(t => {
            const s = t.weeklyScores;
            const mean = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 110;
            const sd = s.length > 1 ? Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (s.length - 1)) : 25;
            stats[t.rosterId] = { mean, sd: Math.max(sd, 12) };
        });
        const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random();
            return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
        const tally = {}; ctx.teams.forEach(t => tally[t.rosterId] = { playoff: 0, releg: 0 });
        const relegN = RELEGATION_RISK_COUNT[ctx.tier] || 0;
        for (let s = 0; s < SIMS; s++) {
            const rec = {}; ctx.teams.forEach(t => rec[t.rosterId] = { w: t.wins, pf: t.fpts });
            future.forEach(([a, b]) => {
                const sa = stats[a].mean + gauss() * stats[a].sd, sb = stats[b].mean + gauss() * stats[b].sd;
                if (sa > sb) rec[a].w++; else rec[b].w++;
                rec[a].pf += sa; rec[b].pf += sb;
            });
            const order = Object.keys(rec).sort((x, y) => rec[y].w - rec[x].w || rec[y].pf - rec[x].pf);
            order.slice(0, 6).forEach(rid => tally[rid].playoff++);
            if (relegN) order.slice(-relegN).forEach(rid => tally[rid].releg++);
        }
        ctx.teams.forEach(t => out[t.rosterId] = {
            playoff: tally[t.rosterId].playoff / SIMS, releg: tally[t.rosterId].releg / SIMS });
    } catch (e) { console.warn('odds sim failed', e); }
    return out;
}

// ═════════════════════════════════════════════════════════════════════════
//  TRADE LAB
// ═════════════════════════════════════════════════════════════════════════
async function renderLab(v) {
    v.innerHTML = spinner('Opening the lab…');
    const tier = APP.labTier;
    const [ctx, fc, pm] = await Promise.all([API.leagueContext(tier), API.fcValues(), API.playerMap()]);

    if (APP.labA === null) APP.labA = ctx.teams[0]?.rosterId;
    if (APP.labB === null) APP.labB = ctx.teams[1]?.rosterId;

    const teamOpt = sel => ctx.teams.map(t =>
        `<option value="${t.rosterId}" ${t.rosterId === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');

    const sideHTML = (side) => {
        const rid = side === 'A' ? APP.labA : APP.labB;
        const selSet = side === 'A' ? APP.labSelA : APP.labSelB;
        const team = ctx.teams.find(t => t.rosterId === +rid);
        const { valued } = rosterValue(team?.players, fc);
        const checks = valued.map(({ pid, e }) => `
            <label class="flex items-center gap-2.5 py-1.5 px-2 rounded hover:bg-white/5 cursor-pointer ${selSet.has(String(pid)) ? 'bg-[#E8C547]/10' : ''}">
                <input type="checkbox" ${selSet.has(String(pid)) ? 'checked' : ''} onchange="labToggle('${side}','${pid}')" class="accent-[#E8C547]">
                <span class="mono text-[9px] w-6 text-slate-500">${e.player.position}</span>
                <span class="text-sm flex-1 truncate">${esc(e.player.name)}</span>
                <span class="mono text-[10px] text-sky-300">${fmtVal(e.value)}</span>
            </label>`).join('');
        // pick options (generic market values for picks)
        const pickOpts = fc.picks.slice(0, 30).map(e =>
            `<option value="pick:${esc(e.player.name)}:${e.value}">${esc(e.player.name)} (${fmtVal(e.value)})</option>`).join('');
        const pickTags = [...selSet].filter(x => x.startsWith('pick:')).map(x => {
            const [, name, val] = x.split(':');
            return `<span class="tx-tag bg-purple-400/10 text-purple-300 cursor-pointer" onclick="labToggle('${side}','${esc(x)}')">${esc(name)} · ${fmtVal(+val)} ✕</span>`;
        }).join(' ');
        return `
        <div class="panel rounded-2xl p-4">
            <select onchange="labSetTeam('${side}', this.value)" class="input-dark w-full mb-3">${teamOpt(+rid)}</select>
            <div class="max-h-72 overflow-y-auto pr-1 mb-3">${checks}</div>
            <select onchange="if(this.value){labToggle('${side}', this.value); this.value=''}" class="input-dark w-full text-xs">
                <option value="">+ Add draft pick (market value)…</option>${pickOpts}</select>
            <div class="flex flex-wrap gap-1.5 mt-2">${pickTags}</div>
        </div>`;
    };

    const sumSide = selSet => {
        let total = 0; const items = [];
        selSet.forEach(x => {
            if (x.startsWith('pick:')) { const [, name, val] = x.split(':'); total += +val; items.push(name); }
            else { const e = fc.bySleeper[x]; if (e) { total += e.value; items.push(e.player.name); } }
        });
        return { total, items };
    };
    const A = sumSide(APP.labSelA), B = sumSide(APP.labSelB);
    const diff = A.total - B.total;
    const tot = A.total + B.total;
    const pctA = tot ? Math.round(A.total / tot * 100) : 50;
    let verdict = 'Select assets on each side to weigh a deal.';
    if (tot > 0) {
        const skew = Math.abs(diff) / Math.max(A.total, B.total, 1);
        verdict = skew < 0.07 ? '⚖️ Dead even — commissioner-proof.'
            : skew < 0.2 ? `Slight edge to ${diff > 0 ? 'Side B (receiving A’s package)' : 'Side A (receiving B’s package)'}.`
            : `🚨 Lopsided — ${diff > 0 ? 'Side A is giving up' : 'Side B is giving up'} ${fmtVal(Math.abs(diff))} more in value. Public shaming may apply (Art. VII).`;
    }

    v.innerHTML = `
        ${sectionHead('The Laboratory', 'TRADE <span class="grad-gold">LAB</span>',
            'Weigh any deal with live FantasyCalc dynasty values (superflex). Draft picks priced at league-wide market rates. Values are a guide — lopsided trades remain legal and shameable.')}
        <div class="flex gap-2 mb-6">${TIER_ORDER.map(t => `
            <button onclick="APP.labTier='${t}';APP.labA=null;APP.labB=null;APP.labSelA.clear();APP.labSelB.clear();render()"
                class="pill ${t === tier ? 'pill-active' : ''}">${esc(LEAGUE_MAP[t].name)}</button>`).join('')}</div>

        <div class="panel-gold rounded-2xl p-5 mb-6">
            <div class="flex justify-between items-baseline mb-2">
                <span class="mono text-xs text-slate-300">SIDE A SENDS · <span class="text-sky-300">${fmtVal(A.total)}</span></span>
                <span class="mono text-xs text-slate-300">SIDE B SENDS · <span class="text-sky-300">${fmtVal(B.total)}</span></span>
            </div>
            <div class="h-2.5 rounded-full overflow-hidden bg-white/5 flex">
                <div class="h-full bg-gradient-to-r from-[#E8C547] to-[#c9a227] transition-all" style="width:${pctA}%"></div>
                <div class="h-full bg-gradient-to-r from-sky-500 to-sky-300 transition-all" style="width:${100 - pctA}%"></div>
            </div>
            <p class="text-sm text-center mt-3 text-slate-300">${verdict}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">${sideHTML('A')}${sideHTML('B')}</div>`;
}
window.labToggle = (side, key) => {
    const s = side === 'A' ? APP.labSelA : APP.labSelB;
    s.has(key) ? s.delete(key) : s.add(key);
    render();
};
window.labSetTeam = (side, rid) => {
    if (side === 'A') { APP.labA = +rid; APP.labSelA.clear(); }
    else { APP.labB = +rid; APP.labSelB.clear(); }
    render();
};

// ═════════════════════════════════════════════════════════════════════════
//  LEGACY — RECORDS · HISTORY · CONSTITUTION
// ═════════════════════════════════════════════════════════════════════════
// ── owner career aggregation (slot-proof: per-season owner_id attribution) ──
function canonicalOwnerId(id) {
    // merge alternate accounts via optional aliasIds on DYNASTY_RANKS entries
    const r = DYNASTY_RANKS.find(d => d.ownerId === id || (d.aliasIds || []).includes(id));
    return r ? r.ownerId : id;
}

async function buildOwnerCareers() {
    const hist = await API.allHistory();
    const owners = {};
    TIER_ORDER.forEach(tier => hist[tier].forEach(s => s.teams.forEach(t => {
        if (!t.ownerId) return;
        const key = canonicalOwnerId(t.ownerId);
        const o = owners[key] ||= { id: key, displays: new Set(), avatar: null, w: 0, l: 0, t: 0, pf: 0,
                                    seasons: [], tiers: { top: 0, mid: 0, cellar: 0 } };
        o.displays.add(t.display);
        if (!o.avatar && t.avatar) o.avatar = t.avatar;
        o.w += t.wins; o.l += t.losses; o.t += t.ties; o.pf += t.fpts;
        if (s.complete) o.tiers[tier]++;
        o.seasons.push({ season: s.season, tier, teamName: t.teamName, wins: t.wins, losses: t.losses,
                         fpts: t.fpts, standing: t.standing, of: s.teams.length, live: !s.complete });
    })));
    Object.values(owners).forEach(o => {
        o.seasons.sort((a, b) => b.season - a.season || TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
        const g = o.w + o.l + o.t;
        o.winPct = g ? o.w / g : 0;
        const dyn = DYNASTY_RANKS.find(d => d.ownerId === o.id);
        o.dyn = dyn || null;
        o.titles = dyn ? HALL_OF_FAME.filter(h => h.team === dyn.team).length : 0;
    });
    return Object.values(owners).sort((a, b) => b.winPct - a.winPct || b.w - a.w);
}

let _careers = null;
async function renderOwnersTab(v, tabs) {
    v.innerHTML = spinner('Reconstructing every career…');
    _careers = _careers || await buildOwnerCareers();
    const tierChip = (n, color, label) => n ? `<span class="mono text-[8px] px-1.5 py-0.5 rounded" style="background:${color}1A;color:${color}" title="${label}">${n}× ${label.replace('The ', '')}</span>` : '';
    const rows = _careers.map((o, i) => `
        <tr class="border-b border-white/5 hover:bg-white/5 cursor-pointer" onclick="openOwner('${o.id}')">
            <td class="p-3 display text-lg text-slate-400">${i + 1}</td>
            <td class="p-3"><div class="flex items-center gap-2.5">
                ${avatarImg(o.avatar, 'w-8 h-8 rounded-lg')}
                <div class="min-w-0">
                    <p class="text-sm font-bold truncate">@${esc([...o.displays][0])}</p>
                    <p class="mono text-[9px] text-slate-600 truncate">${o.dyn ? esc(o.dyn.team) : esc(o.seasons[0]?.teamName || '')}</p>
                </div></div></td>
            <td class="p-3 mono text-sm">${o.w}-${o.l}${o.t ? '-' + o.t : ''}</td>
            <td class="p-3 mono text-xs ${o.winPct >= 0.55 ? 'text-emerald-400' : o.winPct < 0.45 ? 'text-red-400' : 'text-slate-300'}">${(o.winPct * 100).toFixed(0)}%</td>
            <td class="p-3 mono text-xs text-slate-400 hidden sm:table-cell">${fmtVal(Math.round(o.pf))}</td>
            <td class="p-3 hidden md:table-cell"><div class="flex gap-1 flex-wrap">
                ${tierChip(o.tiers.top, '#E8C547', 'The Top Level')}${tierChip(o.tiers.mid, '#AEB8C4', 'The Mid League')}${tierChip(o.tiers.cellar, '#C97B4A', 'The Cellar')}
            </div></td>
            <td class="p-3">${o.titles ? `<span class="badge bg-yellow-400/10 text-yellow-400" title="${o.titles} championship(s)"><i class="fa-solid fa-trophy"></i></span>` : ''}
                ${o.dyn ? `<span class="mono text-[9px] ${o.dyn.score < 0 ? 'text-red-400' : 'text-[#E8C547]'} ml-1">${o.dyn.score.toFixed(0)}</span>` : ''}</td>
        </tr>`).join('');
    v.innerHTML = `${sectionHead('Every Climber, Every Season', 'OWNER <span class="grad-gold">CAREERS</span>',
        'True career records rebuilt season-by-season from Sleeper history and credited to the human, not the roster slot — promotion and relegation can no longer scramble the books. Click an owner for their full expedition log.')}${tabs}
        <div class="panel rounded-2xl overflow-hidden"><div class="overflow-x-auto">
        <table class="w-full text-left">
            <thead><tr class="bg-white/5 mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
                <th class="p-3">#</th><th class="p-3">Owner</th><th class="p-3">Career W-L</th><th class="p-3">Win%</th>
                <th class="p-3 hidden sm:table-cell">Career PF</th><th class="p-3 hidden md:table-cell">Seasons</th><th class="p-3">Honors · D-Score</th>
            </tr></thead><tbody>${rows}</tbody>
        </table></div></div>
        <p class="mono text-[9px] text-slate-600 uppercase tracking-widest mt-3">Regular-season records from each season's own league data · current season included live · multi-account owners mergeable via aliasIds in constants.js</p>`;
}

window.openOwner = id => {
    const o = _careers?.find(x => x.id === id);
    if (!o) return;
    const modal = document.getElementById('modal');
    document.body.classList.add('modal-open'); modal.classList.remove('hidden');
    const log = o.seasons.map(s => `
        <tr class="border-b border-white/5">
            <td class="p-2.5 mono text-xs">${s.season}${s.live ? ' <span class="text-red-400">●</span>' : ''}</td>
            <td class="p-2.5"><span class="mono text-[9px] px-1.5 py-0.5 rounded" style="background:${LEAGUE_MAP[s.tier].color}1A;color:${LEAGUE_MAP[s.tier].color}">${esc(LEAGUE_MAP[s.tier].name.replace('The ', ''))}</span></td>
            <td class="p-2.5 text-sm truncate max-w-[10rem]">${esc(s.teamName)}</td>
            <td class="p-2.5 mono text-xs">${s.wins}-${s.losses}</td>
            <td class="p-2.5 mono text-xs text-slate-400">${Math.round(s.fpts)}</td>
            <td class="p-2.5 mono text-xs ${s.standing === 1 ? 'text-[#E8C547]' : s.standing <= 3 ? 'text-emerald-400' : 'text-slate-400'}">${s.standing}/${s.of}</td>
        </tr>`).join('');
    document.getElementById('modal-body').innerHTML = `
        <div class="flex items-center gap-4 mb-5">
            ${avatarImg(o.avatar, 'w-16 h-16 rounded-xl')}
            <div>
                <h2 class="display text-2xl uppercase">@${esc([...o.displays][0])}</h2>
                <p class="mono text-[10px] text-slate-500">${o.dyn ? esc(o.dyn.team) + ' · ' : ''}career ${o.w}-${o.l} · ${(o.winPct * 100).toFixed(0)}% · ${fmtVal(Math.round(o.pf))} PF
                ${o.titles ? ` · <span class="text-yellow-400">${o.titles}× champion</span>` : ''}</p>
                ${o.dyn ? badgesHTML(o.dyn, CHAMPION_TEAMS.includes(o.dyn.team), false) : ''}
            </div>
        </div>
        <div class="panel rounded-xl overflow-hidden"><div class="overflow-x-auto">
        <table class="w-full text-left">
            <thead><tr class="bg-white/5 mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
                <th class="p-2.5">Year</th><th class="p-2.5">Level</th><th class="p-2.5">Team</th>
                <th class="p-2.5">W-L</th><th class="p-2.5">PF</th><th class="p-2.5">Finish</th>
            </tr></thead><tbody>${log}</tbody>
        </table></div></div>
        ${o.dyn?.breakdown ? `<p class="mono text-[9px] text-slate-600 uppercase tracking-widest mt-3">D-Score ${o.dyn.score.toFixed(2)} · see Dynasty tab for breakdown</p>` : ''}`;
};

async function renderLegacy(v) {
    const tab = APP.legacyTab;
    const tabs = `<div class="flex gap-2 mb-8 flex-wrap">
        ${['records', 'history', 'owners', 'constitution'].map(t => `
        <button onclick="go('legacy','${t}')" class="pill ${tab === t ? 'pill-active' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>`;

    if (tab === 'owners') return renderOwnersTab(v, tabs);
    if (tab === 'records') {
        const hof = HALL_OF_FAME.map(h => `
            <div class="champ-banner rounded-2xl p-6">
                <p class="mono text-[9px] uppercase tracking-[0.3em] text-yellow-200/50 mb-1">Season ${h.seasonNum} · ${h.season}</p>
                <h4 class="display text-2xl text-white uppercase">${esc(h.team)}</h4>
                <p class="mono text-[10px] text-slate-300/70 mt-1">${esc(h.owner)}</p>
                <span class="inline-block mt-3 bg-black/40 px-2.5 py-1 rounded mono text-[9px] uppercase text-yellow-300"><i class="fa-solid fa-certificate mr-1"></i>${esc(h.jacket)}</span>
            </div>`).join('');
        const recs = DYNASTY_RECORDS.map(r => `
            <div class="panel rounded-2xl p-5 relative overflow-hidden">
                <i class="fa-solid ${r.icon} absolute -right-3 -bottom-3 text-6xl opacity-5"></i>
                <p class="mono text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-2"><i class="fa-solid ${r.icon} ${r.color} mr-1.5"></i>${esc(r.label)}</p>
                <p class="display text-2xl">${esc(r.val)}</p>
                <p class="mono text-[10px] text-[#E8C547]/80 uppercase mt-1">${esc(r.owner)}</p>
            </div>`).join('');
        v.innerHTML = `${sectionHead('Etched in Stone', 'RECORDS & <span class="grad-gold">HONORS</span>')}${tabs}
            <h3 class="display text-xl uppercase mb-4 text-slate-300">Hall of Fame</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">${hof}</div>
            <h3 class="display text-xl uppercase mb-4 text-slate-300">Permanent Records</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${recs}</div>`;
        return;
    }

    if (tab === 'history') {
        const nodes = SEASON_HISTORY.map((s, i) => `
            <div class="relative pl-8 pb-10 ${i === SEASON_HISTORY.length - 1 ? '' : 'timeline-seg'}">
                <div class="absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 ${s.live ? 'border-red-400 bg-red-400/20 animate-pulse' : 'border-[#E8C547] bg-[#0B0E14]'}"></div>
                <p class="mono text-[9px] uppercase tracking-[0.3em] text-slate-500">Season ${s.num} · ${s.season}</p>
                <h3 class="display text-2xl uppercase ${s.live ? 'text-white' : 'grad-gold'} mb-2">${esc(s.title)}${s.live ? ' <span class="text-red-400 text-sm">●</span>' : ''}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="panel rounded-xl p-4 space-y-1.5 text-sm text-slate-400">
                        ${s.champ ? `<p><i class="fa-solid fa-trophy text-yellow-400 text-xs mr-2"></i>Champion: <strong class="text-white">${esc(s.champ)}</strong></p>
                        <p><i class="fa-solid fa-certificate text-yellow-600 text-xs mr-2"></i>${esc(s.jacket)}</p>` :
                        `<p><i class="fa-solid fa-question text-slate-600 text-xs mr-2"></i>Champion: <em>TBD</em></p>`}
                        ${s.facts.map(f => `<p><i class="fa-solid fa-angle-right text-[#E8C547]/50 text-xs mr-2"></i>${esc(f)}</p>`).join('')}
                    </div>
                    <div class="panel rounded-xl p-4 mono text-[10px] text-slate-500 space-y-1">
                        <p class="text-slate-400 font-bold uppercase tracking-[0.2em] text-[9px] mb-1.5">${s.live ? 'Watch this season' : 'Notable events'}</p>
                        ${s.events.map(e => `<p>· ${esc(e)}</p>`).join('')}
                    </div>
                </div>
            </div>`).join('');
        const retired = RETIRED_OWNERS.map(r => `
            <div class="panel rounded-xl p-4 border-l-2 ${r.honorable ? 'border-l-emerald-700' : 'border-l-red-900'}">
                <p class="mono text-[9px] uppercase tracking-[0.2em] ${r.honorable ? 'text-emerald-500' : 'text-red-500'} mb-1">${r.honorable ? 'Honorable Discharge' : 'Other than Honorable'}</p>
                <p class="font-bold text-sm">${esc(r.name)}</p>
                <p class="mono text-[10px] text-slate-500">${esc(r.detail)}</p>
            </div>`).join('');
        v.innerHTML = `${sectionHead('The Expedition Log', 'SEASON <span class="grad-gold">HISTORY</span>', '1st Dynasty · 2023–Present')}${tabs}
            <div class="max-w-3xl">${nodes}</div>
            <h3 class="display text-xl uppercase mt-6 mb-1 text-slate-400">Retired Owners</h3>
            <p class="mono text-[9px] uppercase tracking-[0.25em] text-slate-600 mb-4">Discharge records of former members</p>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${retired}</div>`;
        return;
    }

    // constitution
    const items = CONSTITUTION.map(item => {
        const isA = item.type === 'amendment';
        return `<div class="const-item panel rounded-xl overflow-hidden" data-text="${esc((item.title + ' ' + item.content).toLowerCase())}" data-id="${item.id}">
            <button onclick="toggleArticle('${item.id}')" class="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                <span class="flex items-center gap-3">
                    <span class="w-1.5 h-1.5 rounded-full ${isA ? 'bg-[#E8C547]/60' : 'bg-white/30'}"></span>
                    <span class="display text-sm uppercase ${isA ? 'text-[#E8C547]/90' : ''}">${esc(item.title)}</span>
                </span>
                <i class="fa-solid fa-chevron-right text-[10px] text-slate-600 transition-transform" id="ch-${item.id}"></i>
            </button>
            <div class="const-body" id="cb-${item.id}">
                <div class="px-6 pb-5 pt-1 text-sm text-slate-400 leading-relaxed border-t border-white/5">${item.content}</div>
            </div>
        </div>`;
    }).join('');
    v.innerHTML = `${sectionHead('The Law of the Mountain', 'THE <span class="grad-gold">CONSTITUTION</span>',
            `Revision ${CONSTITUTION_META.revision} · Commissioner: ${CONSTITUTION_META.commissioner}`)}${tabs}
        <div class="flex flex-col sm:flex-row gap-2 mb-5">
            <input oninput="filterConst(this.value)" type="text" placeholder="Search the law…" class="input-dark flex-1">
            <button onclick="document.querySelectorAll('.const-body').forEach(e=>e.classList.add('open'));document.querySelectorAll('[id^=ch-]').forEach(e=>e.style.transform='rotate(90deg)')" class="pill">Expand all</button>
            <button onclick="document.querySelectorAll('.const-body').forEach(e=>e.classList.remove('open'));document.querySelectorAll('[id^=ch-]').forEach(e=>e.style.transform='')" class="pill">Collapse</button>
            <a href="${GOOGLE_DOC_URL}" target="_blank" class="pill"><i class="fa-solid fa-scroll mr-1"></i>Google Doc</a>
        </div>
        <div class="space-y-2.5">${items}</div>`;
}
window.toggleArticle = id => {
    const b = document.getElementById(`cb-${id}`), c = document.getElementById(`ch-${id}`);
    b.classList.toggle('open');
    c.style.transform = b.classList.contains('open') ? 'rotate(90deg)' : '';
};
window.filterConst = q => {
    q = q.toLowerCase().trim();
    document.querySelectorAll('.const-item').forEach(el => {
        const match = !q || el.dataset.text.includes(q);
        el.style.display = match ? '' : 'none';
        if (match && q) {
            document.getElementById(`cb-${el.dataset.id}`).classList.add('open');
            document.getElementById(`ch-${el.dataset.id}`).style.transform = 'rotate(90deg)';
        }
    });
};

// ─── SCROLL ROPE / ALTITUDE ─────────────────────────────────────────────────
window.addEventListener('scroll', () => {
    const st = window.scrollY, dh = document.documentElement.scrollHeight - window.innerHeight;
    const pct = dh > 0 ? Math.round(st / dh * 100) : 0;
    const rope = document.getElementById('scroll-rope');
    if (rope) rope.style.height = pct + '%';
    const btn = document.getElementById('back-to-top');
    if (btn) btn.classList.toggle('show', st > 400);
});

// ─── INIT ───────────────────────────────────────────────────────────────────
window.onclick = e => { if (e.target.id === 'modal') closeModal(); };
window.onload = () => {
    API.playerMap().catch(() => {}); // warm the cache
    go('hq');
};

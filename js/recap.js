// ═════════════════════════════════════════════════════════════════════════
//  IT'S THE CLIMB — RECAP ENGINE
//  Preseason Preview · Weekly Recap · Season Recap
//  Pure computation + renderers. Helpers (esc, fmtVal, …) live in app.js.
// ═════════════════════════════════════════════════════════════════════════

// ── shared bits ─────────────────────────────────────────────────────────────
function awardCard(icon, color, title, team, line) {
    return `<div class="panel rounded-xl p-4 relative overflow-hidden">
        <i class="fa-solid ${icon} absolute -right-3 -bottom-3 text-6xl opacity-5"></i>
        <p class="mono text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-1.5"><i class="fa-solid ${icon} ${color} mr-1.5"></i>${title}</p>
        <p class="display text-lg uppercase leading-tight">${esc(team)}</p>
        <p class="mono text-[10px] text-slate-400 mt-1">${line}</p>
    </div>`;
}

function pairGames(weekMatchups) {
    const pairs = {};
    (weekMatchups || []).forEach(m => { (pairs[m.matchup_id] ||= []).push(m); });
    return Object.values(pairs).filter(p => p.length === 2);
}

// ── WEEKLY RECAP (current season) ───────────────────────────────────────────
function computeWeeklyRecap(ctx, wk) {
    const games = pairGames(ctx.weeklyMatchups[wk - 1]).map(([a, b]) => {
        const ta = ctx.teams.find(t => t.rosterId === a.roster_id);
        const tb = ctx.teams.find(t => t.rosterId === b.roster_id);
        const [w, l, wt, lt] = a.points >= b.points ? [a, b, ta, tb] : [b, a, tb, ta];
        return { w, l, wt, lt, margin: w.points - l.points };
    }).filter(g => g.w.points > 0);
    if (!games.length) return null;

    const scores = games.flatMap(g => [{ m: g.w, t: g.wt }, { m: g.l, t: g.lt }]);
    const high = scores.reduce((a, b) => b.m.points > a.m.points ? b : a);
    const low = scores.reduce((a, b) => b.m.points < a.m.points ? b : a);
    const closest = games.reduce((a, b) => b.margin < a.margin ? b : a);
    const blowout = games.reduce((a, b) => b.margin > a.margin ? b : a);
    const upset = games.filter(g => (g.wt?.standing || 0) - (g.lt?.standing || 0) >= 4)
                       .sort((a, b) => (b.wt.standing - b.lt.standing) - (a.wt.standing - a.lt.standing))[0] || null;
    // points left on bench (when Sleeper provides players_points)
    let bench = null;
    scores.forEach(({ m, t }) => {
        if (!m.players_points || !m.starters) return;
        const total = Object.values(m.players_points).reduce((x, y) => x + y, 0);
        const left = total - m.points;
        if (left > 0 && (!bench || left > bench.left)) bench = { t, left };
    });
    return { games, high, low, closest, blowout, upset, bench };
}

function weeklyRecapHTML(ctx, wk, cfg) {
    const r = computeWeeklyRecap(ctx, wk);
    if (!r) return errBox('No completed games for that week yet.');
    const cards = [
        awardCard('fa-mountain', 'text-[#E8C547]', 'Climber of the Week', r.high.t?.name || '?', `${r.high.m.points.toFixed(2)} pts — highest on the mountain`),
        awardCard('fa-person-falling', 'text-red-400', 'Basecamp Dweller', r.low.t?.name || '?', `${r.low.m.points.toFixed(2)} pts — thin air down there`),
        awardCard('fa-scale-balanced', 'text-sky-400', 'Photo Finish', `${r.closest.wt?.name || '?'}`, `edged ${esc(r.closest.lt?.name || '?')} by ${r.closest.margin.toFixed(2)}`),
        awardCard('fa-hammer', 'text-orange-400', 'The Avalanche', `${r.blowout.wt?.name || '?'}`, `buried ${esc(r.blowout.lt?.name || '?')} by ${r.blowout.margin.toFixed(2)}`)
    ];
    if (r.upset) cards.push(awardCard('fa-bolt', 'text-purple-400', 'Upset of the Week', r.upset.wt.name,
        `#${r.upset.wt.standing} toppled #${r.upset.lt.standing} ${esc(r.upset.lt.name)}`));
    if (r.bench) cards.push(awardCard('fa-couch', 'text-slate-400', 'Left on the Bench', r.bench.t?.name || '?',
        `${r.bench.left.toFixed(1)} pts never saw the field`));

    const board = r.games.map(g => `
        <div class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 text-sm">
            <span class="flex-1 text-right truncate font-semibold">${esc(g.wt?.name || '?')}</span>
            <span class="mono text-[#E8C547]">${g.w.points.toFixed(1)}</span>
            <span class="mono text-[9px] text-slate-600">—</span>
            <span class="mono text-slate-400">${g.l.points.toFixed(1)}</span>
            <span class="flex-1 truncate text-slate-400">${esc(g.lt?.name || '?')}</span>
            <span class="mono text-[9px] ${g.margin < 5 ? 'text-sky-400' : 'text-slate-600'} w-12 text-right">+${g.margin.toFixed(1)}</span>
        </div>`).join('');

    return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">${cards.join('')}</div>
        <div class="panel rounded-2xl p-5">
            <h3 class="display text-lg uppercase mb-2" style="color:${cfg.color}">Week ${wk} Final Scores</h3>${board}
        </div>`;
}

// ── SEASON RECAP (any completed season, from history) ───────────────────────
function computeSeasonRecap(seasonObj, weekly) {
    const teamOf = rid => seasonObj.teams.find(t => t.rosterId === rid);
    let high = null, low = null, closest = null, blowout = null;
    const weeklyHighs = {};
    weekly.forEach((wkM, i) => {
        const games = pairGames(wkM).filter(([a, b]) => a.points > 0 || b.points > 0);
        if (!games.length) return;
        let wkBest = null;
        games.forEach(([a, b]) => {
            [a, b].forEach(m => {
                if (!high || m.points > high.pts) high = { t: teamOf(m.roster_id), pts: m.points, wk: i + 1 };
                if (m.points > 0 && (!low || m.points < low.pts)) low = { t: teamOf(m.roster_id), pts: m.points, wk: i + 1 };
                if (!wkBest || m.points > wkBest.points) wkBest = m;
            });
            const margin = Math.abs(a.points - b.points);
            const wm = a.points >= b.points ? a : b, lm = a.points >= b.points ? b : a;
            if (!closest || margin < closest.margin) closest = { w: teamOf(wm.roster_id), l: teamOf(lm.roster_id), margin, wk: i + 1 };
            if (!blowout || margin > blowout.margin) blowout = { w: teamOf(wm.roster_id), l: teamOf(lm.roster_id), margin, wk: i + 1 };
        });
        if (wkBest) { const t = teamOf(wkBest.roster_id); if (t) weeklyHighs[t.rosterId] = (weeklyHighs[t.rosterId] || 0) + 1; }
    });
    const hsKing = Object.entries(weeklyHighs).sort((a, b) => b[1] - a[1])[0];
    // longest win streak from each team's W/L string
    let streak = null;
    seasonObj.teams.forEach(t => {
        const runs = (t.weekLog || '').split(/[^W]+/).map(s => s.length);
        const best = Math.max(0, ...runs);
        if (!streak || best > streak.n) streak = { t, n: best };
    });
    const byPts = [...seasonObj.teams].sort((a, b) => b.fpts - a.fpts);
    const final = seasonObj.bracket?.find(m => m.p === 1);
    const third = seasonObj.bracket?.find(m => m.p === 3);
    return { high, low, closest, blowout,
        hsKing: hsKing ? { t: teamOf(+hsKing[0]), n: hsKing[1] } : null,
        streak, ptsChamp: byPts[0], bestRecord: seasonObj.teams[0],
        champ: final ? teamOf(final.w) : null, second: final ? teamOf(final.l) : null,
        third: third ? teamOf(third.w) : null };
}

function seasonRecapHTML(seasonObj, weekly, tier, cfg) {
    const r = computeSeasonRecap(seasonObj, weekly);
    const champBanner = r.champ ? `
        <div class="champ-banner rounded-2xl p-6 mb-6">
            <p class="mono text-[9px] uppercase tracking-[0.3em] text-yellow-200/60 mb-1">${seasonObj.season} ${esc(cfg.name)} Champion</p>
            <h3 class="display text-3xl text-white uppercase">${esc(r.champ.teamName)}</h3>
            <p class="mono text-[10px] text-slate-300/70 mt-1">@${esc(r.champ.display)} · ${r.champ.wins}-${r.champ.losses} · ${Math.round(r.champ.fpts)} PF</p>
            ${r.second ? `<p class="mono text-[10px] text-yellow-100/50 mt-2">def. ${esc(r.second.teamName)} in the final${r.third ? ` · 3rd: ${esc(r.third.teamName)}` : ''}</p>` : ''}
        </div>` : '';
    const cards = [];
    if (r.bestRecord) cards.push(awardCard('fa-ranking-star', 'text-[#E8C547]', 'Best Record', r.bestRecord.teamName, `${r.bestRecord.wins}-${r.bestRecord.losses} regular season`));
    if (r.ptsChamp) cards.push(awardCard('fa-calculator', 'text-sky-400', 'Points Champion', r.ptsChamp.teamName, `${r.ptsChamp.fpts.toFixed(2)} total points`));
    if (r.high) cards.push(awardCard('fa-fire', 'text-orange-400', 'Highest Single Game', r.high.t?.teamName || '?', `${r.high.pts.toFixed(2)} pts · week ${r.high.wk}`));
    if (r.streak && r.streak.n >= 3) cards.push(awardCard('fa-bolt', 'text-emerald-400', 'Longest Win Streak', r.streak.t.teamName, `${r.streak.n} straight wins`));
    if (r.hsKing && r.hsKing.n >= 2) cards.push(awardCard('fa-crown', 'text-purple-400', 'Most Weekly Highs', r.hsKing.t?.teamName || '?', `top scorer ${r.hsKing.n} different weeks`));
    if (r.closest) cards.push(awardCard('fa-scale-balanced', 'text-sky-300', 'Game of the Year', r.closest.w?.teamName || '?', `beat ${esc(r.closest.l?.teamName || '?')} by ${r.closest.margin.toFixed(2)} · wk ${r.closest.wk}`));
    if (r.blowout) cards.push(awardCard('fa-hammer', 'text-red-400', 'Beatdown of the Year', r.blowout.w?.teamName || '?', `by ${r.blowout.margin.toFixed(2)} over ${esc(r.blowout.l?.teamName || '?')} · wk ${r.blowout.wk}`));
    if (r.low) cards.push(awardCard('fa-person-falling', 'text-slate-400', 'Rock Bottom', r.low.t?.teamName || '?', `${r.low.pts.toFixed(2)} pts · week ${r.low.wk}`));

    const table = seasonObj.teams.map(t => `
        <tr class="border-b border-white/5 ${t.standing === 1 ? 'bg-[#E8C547]/5' : ''}">
            <td class="p-2.5 mono text-xs ${t.standing <= 3 ? 'text-[#E8C547]' : 'text-slate-500'}">${t.standing}</td>
            <td class="p-2.5 text-sm font-semibold">${esc(t.teamName)} <span class="mono text-[9px] text-slate-600">@${esc(t.display)}</span></td>
            <td class="p-2.5 mono text-xs">${t.wins}-${t.losses}</td>
            <td class="p-2.5 mono text-xs text-slate-400">${Math.round(t.fpts)}</td>
            <td class="p-2.5 mono text-[9px] text-slate-600 hidden sm:table-cell">${esc(t.weekLog || '')}</td>
        </tr>`).join('');

    return `${champBanner}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">${cards.join('')}</div>
        <div class="panel rounded-2xl overflow-hidden"><div class="overflow-x-auto">
        <table class="w-full text-left">
            <thead><tr class="bg-white/5 mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
                <th class="p-2.5">#</th><th class="p-2.5">Team</th><th class="p-2.5">W-L</th><th class="p-2.5">PF</th><th class="p-2.5 hidden sm:table-cell">Week-by-Week</th>
            </tr></thead><tbody>${table}</tbody>
        </table></div></div>`;
}

// ── PRESEASON PREVIEW (market-driven) ───────────────────────────────────────
function previewHTML(ctx, fc, tier, cfg) {
    if (!fc) return errBox('Market data unavailable — the preview needs FantasyCalc.');
    const rated = ctx.teams.map(team => {
        const { total, valued } = rosterValue(team.players, fc);
        return { team, total, valued, groups: posGroups(valued), age: avgRosterAge(valued),
                 heat: valued.reduce((s, x) => s + (x.e.trend30Day || 0), 0) };
    }).sort((a, b) => b.total - a.total);
    const sumVal = rated.reduce((s, r) => s + r.total, 0) || 1;

    // storylines (top tier gets dynasty drama)
    let story = '';
    if (tier === 'top') {
        const champ = HALL_OF_FAME[0];
        const rookies = DYNASTY_RANKS.filter(d => d.entered === SEASON).map(d => d.team);
        const t = DYNASTY_STATUS.triggers[0];
        story = `<div class="panel-gold rounded-2xl p-5 mb-6 space-y-2 text-sm text-slate-300">
            <p class="mono text-[9px] uppercase tracking-[0.3em] text-[#E8C547]/70 mb-2">Season ${SEASON_NUM} Storylines</p>
            <p><i class="fa-solid fa-trophy text-yellow-400 text-xs mr-2"></i><strong>${esc(champ.team)}</strong> defends the ${champ.season} crown — a repeat would put the back-to-back "get out of relegation" card in play <em>and</em> push the redraft trigger to ${t.progress + 1}/${t.total}.</p>
            ${rookies.length ? `<p><i class="fa-solid fa-person-hiking text-emerald-400 text-xs mr-2"></i>New climbers at altitude: <strong>${rookies.map(esc).join(', ')}</strong> — first Top Level air for all of them.</p>` : ''}
            ${IMMUNITY_TEAMS_DATA.map(i => `<p><i class="fa-solid fa-crown text-emerald-400 text-xs mr-2"></i><strong>${esc(i.team)}</strong> climbs with a rope: immune from relegation through ${i.expires} (${esc(i.reason)}).</p>`).join('')}
            <p><i class="fa-solid fa-triangle-exclamation text-red-400 text-xs mr-2"></i>${RELEGATION_RISK_COUNT.top} teams go down the mountain in ${SEASON}. Nobody wants the Cellar invite.</p>
        </div>`;
    }

    // superlatives
    const posLeader = pos => rated.reduce((a, b) => (b.groups[pos] || 0) > (a.groups[pos] || 0) ? b : a);
    const youngest = rated.filter(r => r.age).reduce((a, b) => b.age < a.age ? b : a, rated.find(r => r.age) || rated[0]);
    const oldest = rated.filter(r => r.age).reduce((a, b) => b.age > a.age ? b : a, rated.find(r => r.age) || rated[0]);
    const hottest = rated.reduce((a, b) => b.heat > a.heat ? b : a);
    const coldest = rated.reduce((a, b) => b.heat < a.heat ? b : a);
    const supers = [
        awardCard('fa-sack-dollar', 'text-[#E8C547]', 'Deepest War Chest', rated[0].team.name, `${fmtVal(rated[0].total)} total value · ${(rated[0].total / sumVal * 100).toFixed(0)}% market title share`),
        awardCard('fa-fire', 'text-orange-400', 'Hottest Offseason', hottest.team.name, `+${fmtVal(Math.max(hottest.heat, 0))} roster value last 30 days`),
        awardCard('fa-snowflake', 'text-sky-300', 'Coldest Offseason', coldest.team.name, `${fmtVal(coldest.heat)} roster value last 30 days`),
        awardCard('fa-baby', 'text-emerald-400', 'Youngest Core', youngest.team.name, `value-weighted age ${youngest.age?.toFixed(1)}`),
        awardCard('fa-hourglass-end', 'text-slate-400', 'Win-Now Window', oldest.team.name, `value-weighted age ${oldest.age?.toFixed(1)} — the clock is ticking`),
        awardCard('fa-user-shield', 'text-red-400', 'Best QB Room', posLeader('QB').team.name, `${fmtVal(posLeader('QB').groups.QB)} in superflex gold`),
        awardCard('fa-person-running', 'text-emerald-400', 'Best RB Stable', posLeader('RB').team.name, `${fmtVal(posLeader('RB').groups.RB)} on the ground`),
        awardCard('fa-hands-catching', 'text-sky-400', 'Best WR Corps', posLeader('WR').team.name, `${fmtVal(posLeader('WR').groups.WR)} through the air`)
    ];

    const median = rated[Math.floor(rated.length / 2)]?.total || 1;
    const order = rated.map((r, i) => {
        const tag = r.total > median * 1.15 ? ['CONTENDER', 'text-emerald-400'] :
                    r.total < median * 0.85 ? ['REBUILDING', 'text-red-400'] : ['IN THE HUNT', 'text-slate-300'];
        const top3 = r.valued.slice(0, 3).map(x => x.e.player.name.split(' ').slice(-1)[0]).join(' · ');
        return `<div class="panel rounded-xl p-4 flex items-center gap-4">
            <span class="display text-2xl w-8 ${i === 0 ? 'text-[#E8C547]' : 'text-slate-500'}">${i + 1}</span>
            ${avatarImg(r.team.avatar, 'w-9 h-9 rounded-lg')}
            <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">${esc(r.team.name)}</p>
                <p class="mono text-[9px] text-slate-500 truncate">${esc(top3)}</p>
                <div class="h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                    <div class="h-full rounded-full" style="width:${Math.round(r.total / rated[0].total * 100)}%;background:${cfg.color}"></div>
                </div>
            </div>
            <div class="text-right flex-shrink-0">
                <span class="mono text-sm text-sky-300 block">${fmtVal(r.total)}</span>
                <span class="mono text-[8px] uppercase tracking-widest ${tag[1]}">${tag[0]}</span>
                <span class="mono text-[8px] text-slate-600 block">${(r.total / sumVal * 100).toFixed(0)}% share</span>
            </div>
        </div>`;
    }).join('');

    return `${story}
        <h3 class="display text-lg uppercase mb-3 text-slate-300">Preseason Superlatives</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">${supers.join('')}</div>
        <h3 class="display text-lg uppercase mb-3 text-slate-300">The Market's Pecking Order</h3>
        <div class="grid grid-cols-1 gap-3">${order}</div>
        <p class="mono text-[9px] text-slate-600 uppercase tracking-widest mt-3">Market title share = team value ÷ league value · FantasyCalc dynasty SF 0.5 PPR · refreshed 6h</p>`;
}

// ── SHARE: weekly recap as group-chat text ──────────────────────────────────
window.copyWeeklyRecap = async () => {
    const tier = APP.recapTier || 'top', cfg = LEAGUE_MAP[tier];
    const ctx = await API.leagueContext(tier);
    if (!ctx.completedWeeks) return;
    const wk = Math.min(APP.recapWeek || ctx.completedWeeks, ctx.completedWeeks);
    const r = computeWeeklyRecap(ctx, wk);
    if (!r) { toast('No completed games for that week yet.'); return; }
    const L = [`🏔️ IT'S THE CLIMB — ${cfg.name} · Week ${wk} Recap`, ''];
    L.push(`⛰️ Climber of the Week: ${r.high.t?.name} — ${r.high.m.points.toFixed(2)} pts`);
    L.push(`🕳️ Basecamp Dweller: ${r.low.t?.name} — ${r.low.m.points.toFixed(2)} pts`);
    L.push(`📸 Photo Finish: ${r.closest.wt?.name} edged ${r.closest.lt?.name} by ${r.closest.margin.toFixed(2)}`);
    L.push(`💥 The Avalanche: ${r.blowout.wt?.name} buried ${r.blowout.lt?.name} by ${r.blowout.margin.toFixed(2)}`);
    if (r.upset) L.push(`⚡ Upset of the Week: #${r.upset.wt.standing} ${r.upset.wt.name} toppled #${r.upset.lt.standing} ${r.upset.lt.name}`);
    if (r.bench) L.push(`🛋️ Left on the Bench: ${r.bench.t?.name} — ${r.bench.left.toFixed(1)} pts never saw the field`);
    L.push('', 'Final scores:');
    r.games.forEach(g => L.push(`  ${g.wt?.name} ${g.w.points.toFixed(1)} — ${g.l.points.toFixed(1)} ${g.lt?.name}`));
    L.push('', `Full recap → https://tpdad.github.io/itstheclimb/#recap/weekly`);
    try { await navigator.clipboard.writeText(L.join('\n')); toast('Recap copied — paste it in the chat'); }
    catch (e) { toast('Copy blocked by browser — select and copy manually.'); }
};

// ── SECTION ROUTER ──────────────────────────────────────────────────────────
async function renderRecap(v) {
    v.innerHTML = spinner('Warming up the press box…');
    const tier = APP.recapTier || 'top';
    const cfg = LEAGUE_MAP[tier];
    const ctx = await API.leagueContext(tier);

    const weeklyOK = ctx.inSeason && ctx.completedWeeks >= 1;
    const sub = APP.recapTab && ['preview', 'weekly', 'season'].includes(APP.recapTab)
        ? APP.recapTab : (weeklyOK ? 'weekly' : 'preview');
    APP.recapTab = sub;

    const subTabs = `<div class="flex gap-2 mb-6 flex-wrap">
        <button onclick="go('recap','preview')" class="pill ${sub === 'preview' ? 'pill-active' : ''}"><i class="fa-solid fa-binoculars mr-1"></i>${SEASON} Preview</button>
        <button onclick="go('recap','weekly')" class="pill ${sub === 'weekly' ? 'pill-active' : ''}" ${weeklyOK ? '' : 'style="opacity:0.4"'}><i class="fa-solid fa-newspaper mr-1"></i>Weekly</button>
        <button onclick="go('recap','season')" class="pill ${sub === 'season' ? 'pill-active' : ''}"><i class="fa-solid fa-book-bookmark mr-1"></i>Season Wraps</button>
    </div>`;
    const tierTabs = `<div class="flex gap-2 mb-6">${TIER_ORDER.map(t => `
        <button onclick="APP.recapTier='${t}';render()" class="pill ${t === tier ? 'pill-active' : ''}">${esc(LEAGUE_MAP[t].name)}</button>`).join('')}</div>`;

    if (sub === 'weekly') {
        if (!weeklyOK) {
            v.innerHTML = `${sectionHead('The Press Box', 'WEEKLY <span class="grad-gold">RECAP</span>', 'Returns with Week 1.')}${subTabs}
                ${errBox(`No completed weeks yet — the ${SEASON} season hasn't kicked off. Check the ${SEASON} Preview instead.`)}`;
            return;
        }
        const wk = Math.min(APP.recapWeek || ctx.completedWeeks, ctx.completedWeeks);
        const wkSel = `<div class="flex flex-wrap items-center gap-3 mb-6">
            <select onchange="APP.recapWeek=+this.value;render()" class="input-dark">
            ${Array.from({ length: ctx.completedWeeks }, (_, i) => i + 1).reverse().map(w =>
                `<option value="${w}" ${w === wk ? 'selected' : ''}>Week ${w}</option>`).join('')}</select>
            <button onclick="copyWeeklyRecap()" class="pill"><i class="fa-solid fa-copy mr-1"></i>Copy for group chat</button></div>`;
        v.innerHTML = `${sectionHead('The Press Box', `WEEK ${wk} <span class="grad-gold">RECAP</span>`,
            `${esc(cfg.name)} · everything that happened on the mountain`)}${subTabs}${tierTabs}${wkSel}
            ${weeklyRecapHTML(ctx, wk, cfg)}`;
        return;
    }

    if (sub === 'season') {
        const hist = await API.tierHistory(tier);
        const done = hist.filter(s => s.complete).sort((a, b) => b.season - a.season);
        if (!done.length) {
            v.innerHTML = `${sectionHead('The Archive', 'SEASON <span class="grad-gold">WRAPS</span>')}${subTabs}${tierTabs}
                ${errBox('No completed seasons for this tier yet.')}`;
            return;
        }
        const yr = done.find(s => s.season === APP.recapSeason) ? APP.recapSeason : done[0].season;
        const seasonObj = done.find(s => s.season === yr);
        const yrSel = `<select onchange="APP.recapSeason=+this.value;render()" class="input-dark mb-6">
            ${done.map(s => `<option value="${s.season}" ${s.season === yr ? 'selected' : ''}>${s.season} Season</option>`).join('')}</select>`;
        v.innerHTML = `${sectionHead('The Archive', `${yr} <span class="grad-gold">SEASON WRAP</span>`,
            `${esc(cfg.name)} · the full story of the climb`)}${subTabs}${tierTabs}${yrSel}${spinner('Pulling the season film…')}`;
        const weekly = await API.seasonMatchups(seasonObj.leagueId);
        v.innerHTML = `${sectionHead('The Archive', `${yr} <span class="grad-gold">SEASON WRAP</span>`,
            `${esc(cfg.name)} · the full story of the climb`)}${subTabs}${tierTabs}${yrSel}
            ${seasonRecapHTML(seasonObj, weekly, tier, cfg)}`;
        return;
    }

    // preview
    const fc = await API.fcValues().catch(() => null);
    v.innerHTML = `${sectionHead('The Press Box', `${SEASON} <span class="grad-gold">PRESEASON PREVIEW</span>`,
        `Season ${SEASON_NUM} of the 1st Dynasty · the market's read on every roster before a snap is played`)}${subTabs}${tierTabs}
        ${previewHTML(ctx, fc, tier, cfg)}`;
}

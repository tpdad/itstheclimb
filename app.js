// ─── APPLICATION STATE ──────────────────────────────────────────────────────
let currentTab = 'top';
let playerMap = null;
let activeLeagueData = { users: [], rosters: [], matchups: [], week: 1 };
let relegationRosterIds = new Set();
let constitutionRendered = false;

// ─── SCROLL ROPE PROGRESS ───────────────────────────────────────────────────
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
    document.getElementById('scroll-rope').style.height = pct + '%';
    document.getElementById('altitude-marker').textContent = `ALT: ${pct}%`;
});

// ─── DATA FETCHING: PLAYER REGISTRY ─────────────────────────────────────────
/**
 * Fetches and caches the NFL player registry from Sleeper API.
 * Per Sleeper API spec: cache locally, max once per day.
 */
async function fetchPlayerMap() {
    const cacheKey = 'nfl_players_cache';
    const cacheTimeKey = 'nfl_players_cache_time';
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);
    
    // Use cache if fresh (less than 24 hours old)
    if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < 24 * 60 * 60 * 1000)) {
        playerMap = JSON.parse(cachedData);
        return;
    }
    
    try {
        const res = await fetch('https://api.sleeper.app/v1/players/nfl');
        const data = await res.json();
        playerMap = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimeKey, Date.now().toString());
    } catch (e) { 
        console.error('Player map fetch failed', e); 
    }
}

// ─── DATA FETCHING: LIVE LEAGUE DATA ────────────────────────────────────────
/**
 * Loads current week's league data from Sleeper API.
 * Fetches: users, rosters, league info, and matchups.
 */
async function loadLeagueData(tier) {
    const lId = LEAGUE_MAP[tier].id;
    const spinner = document.getElementById('loading-spinner');
    const matchupsSection = document.getElementById('live-matchups-section');
    
    spinner.style.display = 'flex';
    matchupsSection.classList.add('hidden');
    
    try {
        const [users, rosters, leagueInfo] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${lId}/users`).then(r => r.json()),
            fetch(`https://api.sleeper.app/v1/league/${lId}/rosters`).then(r => r.json()),
            fetch(`https://api.sleeper.app/v1/league/${lId}`).then(r => r.json())
        ]);
        
        const week = leagueInfo.settings.leg || 1;
        const matchups = await fetch(`https://api.sleeper.app/v1/league/${lId}/matchups/${week}`).then(r => r.json());
        
        activeLeagueData = { users, rosters, matchups, week };
        renderStandings(tier);
        if (tier === 'top') renderLiveMatchups();
    } catch (e) {
        console.error('League sync error', e);
    } finally {
        spinner.style.display = 'none';
    }
}

// ─── DYNASTY DATA LOOKUP ────────────────────────────────────────────────────
/**
 * Finds dynasty ranking info for a team by owner name or team name.
 */
function getDynastyInfo(user, teamName) {
    if (!user && !teamName) return null;
    const uName = (user?.display_name || '').toLowerCase().trim();
    const tName = (teamName || '').toLowerCase().trim()
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "'"); // normalize apostrophes

    return DYNASTY_RANKS.find(r => {
        const normalizedTeam = r.team.toLowerCase()
            .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "'");
        const isOwner = r.owners && r.owners.some(o => uName === o || uName.includes(o) || o.includes(uName));
        const isTeam = tName === normalizedTeam || tName.includes(normalizedTeam) || normalizedTeam.includes(tName);
        return isOwner || isTeam;
    });
}

/**
 * Gets the current dynasty rank number (1-based) for a team.
 */
function getDynastyRankNum(dynInfo) {
    if (!dynInfo) return null;
    const sorted = [...DYNASTY_RANKS].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex(d => d.team === dynInfo.team);
    return idx !== -1 ? idx + 1 : null;
}

/**
 * Checks if a team has relegation immunity and returns details.
 */
function getImmunityInfo(teamName, displayName) {
    return IMMUNITY_TEAMS_DATA.find(i =>
        i.team.toLowerCase() === (teamName || '').toLowerCase() ||
        i.owner.toLowerCase() === (displayName || '').toLowerCase()
    );
}

// ─── BADGE RENDERING ────────────────────────────────────────────────────────
/**
 * Generates HTML for team achievement badges.
 */
function getBadgesHTML(dynInfo, isChamp, isRelegation = false) {
    let html = '<div class="flex flex-wrap gap-1 mt-2">';
    
    if (isChamp) {
        const cfg = RECORD_BADGES['Championship'];
        html += `<div class="badge-icon ${cfg.bg} ${cfg.color}" title="Dynasty Champion"><i class="fa-solid ${cfg.icon}"></i></div>`;
    }
    
    if (dynInfo?.bonus && dynInfo.bonus !== '-') {
        dynInfo.bonus.split(',').map(b => b.trim()).forEach(b => {
            if (b === 'Relegation Risk') return;
            if (b === 'Championship') return;
            const cfg = RECORD_BADGES[b] || { icon: 'fa-medal', color: 'text-gray-400', bg: 'bg-gray-400/10' };
            html += `<div class="badge-icon ${cfg.bg} ${cfg.color}" title="${b}"><i class="fa-solid ${cfg.icon}"></i></div>`;
        });
    }
    
    if (dynInfo?.sloppyException) {
        html += `<div class="badge-icon bg-[#8B4513]/20 text-[#cd853f]" title="Sloppy Exception (Amendment X)"><i class="fa-solid fa-hat-cowboy"></i></div>`;
    }
    
    if (isRelegation) {
        const cfg = RECORD_BADGES['Relegation Risk'];
        html += `<div class="badge-icon ${cfg.bg} ${cfg.color} relegation-badge" title="Relegation Risk"><i class="fa-solid ${cfg.icon}"></i></div>`;
    }
    
    html += '</div>';
    return html;
}

// ─── D-SCORE BREAKDOWN ──────────────────────────────────────────────────────
/**
 * Generates expandable D-Score breakdown showing all point sources.
 */
function getDScoreBreakdownHTML(dynInfo, cardId) {
    if (!dynInfo?.breakdown) return '';
    
    const bd = dynInfo.breakdown;
    const items = DSCORE_LINE_ITEMS
        .filter(item => bd[item.key] !== undefined && bd[item.key] !== 0 && bd[item.key] !== null)
        .map(item => {
            const val = bd[item.key];
            const isNeg = item.key === 'relegated' || item.key === 'bottom4';
            return `<div class="flex justify-between items-center py-0.5">
                <span class="text-gray-500 text-[10px] mono">${item.label}</span>
                <span class="text-[10px] mono font-bold ${isNeg ? 'text-red-500' : 'text-gray-300'}">
                    ${item.key === 'winPct' ? val + '%' : '×' + val} <span class="text-gray-600">${item.pts}</span>
                </span>
            </div>`;
        }).join('');

    return `
    <div class="mt-3 border-t border-white/5 pt-3">
        <button onclick="toggleBreakdown('${cardId}')" class="flex items-center gap-2 text-[10px] mono uppercase tracking-widest text-gray-600 hover:text-[#D4AF37] transition-colors w-full">
            <i class="fa-solid fa-chart-bar text-[8px]"></i> D-Score Breakdown
            <i class="fa-solid fa-chevron-down text-[8px] ml-auto transition-transform" id="chevron-${cardId}"></i>
        </button>
        <div class="dscore-breakdown" id="breakdown-${cardId}">
            <div class="mt-2 space-y-0.5 bg-black/20 rounded p-2">
                ${items}
                <div class="flex justify-between items-center border-t border-white/5 pt-1 mt-1">
                    <span class="text-gray-400 text-[10px] mono font-bold">TOTAL D-SCORE</span>
                    <span class="text-[10px] mono font-black rank-gold">${dynInfo.score.toFixed(2)}</span>
                </div>
            </div>
        </div>
    </div>`;
}

/**
 * Toggles D-Score breakdown visibility.
 */
function toggleBreakdown(id) {
    const el = document.getElementById(`breakdown-${id}`);
    const chevron = document.getElementById(`chevron-${id}`);
    el.classList.toggle('open');
    chevron.style.transform = el.classList.contains('open') ? 'rotate(180deg)' : '';
}

// ─── STANDINGS GRID ─────────────────────────────────────────────────────────
/**
 * Renders the main standings grid with all teams for a given tier.
 */
function renderStandings(tier) {
    const grid = document.getElementById('standings-grid');
    grid.innerHTML = '';

    const sortedRosters = [...activeLeagueData.rosters].sort((a, b) => {
        if (b.settings.wins !== a.settings.wins) return b.settings.wins - a.settings.wins;
        return (b.settings.fpts + b.settings.fpts_decimal / 100) - (a.settings.fpts + a.settings.fpts_decimal / 100);
    });

    const sortedDynastyRanks = [...DYNASTY_RANKS].sort((a, b) => b.score - a.score);

    // Identify teams in relegation zone
    relegationRosterIds = new Set();
    const riskCount = RELEGATION_RISK_COUNT[tier] || 0;
    if (riskCount > 0) sortedRosters.slice(-riskCount).forEach(r => relegationRosterIds.add(r.roster_id));

    sortedRosters.forEach((roster, index) => {
        const user = activeLeagueData.users.find(u => u.user_id === roster.owner_id);
        const teamName = user?.metadata?.team_name || user?.display_name || `Team ${roster.roster_id}`;
        const immunityInfo = getImmunityInfo(teamName, user?.display_name);
        const hasImmunity = !!immunityInfo;
        const dynInfo = getDynastyInfo(user, teamName);
        const isChamp = dynInfo && CHAMPION_TEAMS.includes(dynInfo.team);
        const isRelegation = relegationRosterIds.has(roster.roster_id);
        const dynRankIdx = dynInfo ? sortedDynastyRanks.findIndex(d => d.team === dynInfo.team) : -1;
        const dynRankNum = dynRankIdx !== -1 ? dynRankIdx + 1 : null;
        const isGoldCard = dynRankNum === 1;
        const dynScoreClass = dynInfo ? (dynInfo.score < 0 ? 'text-red-500' : 'rank-gold') : 'text-gray-500';
        const dynScoreText = dynInfo ? dynInfo.score.toFixed(2) : 'Unranked';
        const dynRankPill = dynRankNum
            ? `<span class="dynasty-rank-pill ${isGoldCard ? 'gold' : 'default'}"><i class="fa-solid fa-ranking-star" style="font-size:8px"></i> D-#${dynRankNum}</span>`
            : '';
        const enteredYear = dynInfo?.entered || '—';
        const cardId = `card-${roster.roster_id}`;

        const card = document.createElement('div');
        card.className = `glass p-5 rounded-xl border-t-2 transition-all hover:scale-[1.02] hover:brightness-110 cursor-pointer premium-shadow ${isGoldCard ? 'gold-card' : ''}`;
        if (!isGoldCard) card.style.borderTopColor = LEAGUE_MAP[tier].color;
        card.onclick = () => showTeamDetails(roster.roster_id);

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 ${isGoldCard ? 'border-[#D4AF37]/30' : ''} overflow-hidden flex-shrink-0">
                    ${user?.avatar
                        ? `<img src="https://sleepercdn.com/avatars/thumbs/${user.avatar}" class="w-full h-full object-cover rounded-lg">`
                        : `<i class="fa-solid fa-shield-halved text-gray-600"></i>`}
                </div>
                <div class="text-right">
                    <span class="oswald text-2xl block leading-none ${isGoldCard ? 'rank-gold' : ''}">#${index + 1}</span>
                    <span class="text-[10px] uppercase font-bold text-gray-500 tracking-widest mono">Standing</span>
                </div>
            </div>
            <div class="mb-4">
                <h4 class="oswald text-lg leading-tight uppercase line-clamp-1 ${isGoldCard ? 'rank-gold' : ''}">${teamName}</h4>
                <p class="text-xs text-gray-500 uppercase tracking-tighter mono">@${user?.display_name || 'Unknown'} · Est. ${enteredYear}</p>
                ${getBadgesHTML(dynInfo, isChamp, isRelegation)}
            </div>
            <div class="flex justify-between items-end border-t border-white/5 pt-4">
                <div class="flex gap-4 flex-wrap">
                    <div>
                        <span class="block text-[10px] uppercase text-gray-500 font-bold mono">W-L</span>
                        <span class="oswald text-lg">${roster.settings.wins}-${roster.settings.losses}</span>
                    </div>
                    <div>
                        <span class="block text-[10px] uppercase text-gray-500 font-bold mono">FPTS</span>
                        <span class="oswald text-lg">${roster.settings.fpts}</span>
                    </div>
                    <div>
                        <span class="block text-[10px] uppercase text-gray-500 font-bold mono">Dynasty</span>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="oswald text-lg ${dynScoreClass}">${dynScoreText}</span>
                            ${dynRankPill}
                        </div>
                    </div>
                </div>
                ${hasImmunity ? `
                    <div class="immunity-badge bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase cursor-help" title="Immune from Relegation · Expires ${immunityInfo.expires} · ${immunityInfo.reason}">
                        <i class="fa-solid fa-crown mr-1"></i>Immune '${String(immunityInfo.expires).slice(-2)}
                    </div>
                ` : ''}
            </div>
            ${getDScoreBreakdownHTML(dynInfo, cardId)}
        `;
        grid.appendChild(card);
    });
}

// ─── LIVE MATCHUPS ──────────────────────────────────────────────────────────
/**
 * Renders current week's head-to-head matchups.
 */
function renderLiveMatchups() {
    const section = document.getElementById('live-matchups-section');
    const grid = document.getElementById('matchups-grid');
    grid.innerHTML = '';
    document.getElementById('current-week-num').innerText = activeLeagueData.week;
    section.classList.remove('hidden');

    const matches = {};
    activeLeagueData.matchups.forEach(m => {
        if (!matches[m.matchup_id]) matches[m.matchup_id] = [];
        matches[m.matchup_id].push(m);
    });

    Object.values(matches).forEach(pair => {
        if (pair.length < 2) return;
        const [m1, m2] = pair;
        const u1 = activeLeagueData.users.find(u => u.user_id === activeLeagueData.rosters.find(r => r.roster_id === m1.roster_id)?.owner_id);
        const u2 = activeLeagueData.users.find(u => u.user_id === activeLeagueData.rosters.find(r => r.roster_id === m2.roster_id)?.owner_id);
        const matchEl = document.createElement('div');
        matchEl.className = 'glass p-4 rounded-lg flex items-center justify-between border-l-4 border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/5 to-transparent';
        matchEl.innerHTML = `
            <div class="flex-1">
                <p class="text-[10px] text-gray-500 uppercase font-bold mb-1 mono">${u1?.display_name || 'T1'}</p>
                <div class="flex justify-between items-center">
                    <span class="oswald text-xl">${m1.points.toFixed(1)}</span>
                    <span class="text-xs text-gray-600 px-2 mono">VS</span>
                    <span class="oswald text-xl">${m2.points.toFixed(1)}</span>
                </div>
                <p class="text-[10px] text-gray-500 uppercase font-bold mt-1 text-right mono">${u2?.display_name || 'T2'}</p>
            </div>
        `;
        grid.appendChild(matchEl);
    });
}

// ─── TEAM DETAIL MODAL ──────────────────────────────────────────────────────
/**
 * Opens detailed view of a team with full roster and lineup.
 */
function showTeamDetails(rosterId) {
    const roster = activeLeagueData.rosters.find(r => r.roster_id === rosterId);
    if (!roster) return;
    
    const user = activeLeagueData.users.find(u => u.user_id === roster.owner_id);
    const matchup = activeLeagueData.matchups.find(m => m.roster_id === rosterId);
    const teamName = user?.metadata?.team_name || user?.display_name || `Team ${roster.roster_id}`;

    const dynInfo = getDynastyInfo(user, teamName);
    const isChamp = dynInfo && CHAMPION_TEAMS.includes(dynInfo.team);
    const isRelegation = relegationRosterIds.has(rosterId);
    const dynRankNum = getDynastyRankNum(dynInfo);
    const isGoldRank = dynRankNum === 1;
    const immunityInfo = getImmunityInfo(teamName, user?.display_name);
    const dynScoreClass = dynInfo ? (dynInfo.score < 0 ? 'text-red-500' : 'rank-gold') : 'text-gray-400';
    const dynScoreText = dynInfo ? dynInfo.score.toFixed(2) : 'Unranked';
    const starters = matchup?.starters || [];
    const bench = (matchup?.players || []).filter(p => !starters.includes(p));
    const positions = ['QB','RB','RB','WR','WR','WR/TE','TE','FLEX','SUPERFLEX','D/ST','K'];
    const posColors = { QB:'text-red-400', RB:'text-green-400', WR:'text-blue-400', TE:'text-orange-400', 'WR/TE':'text-orange-300', FLEX:'text-purple-400', SUPERFLEX:'text-pink-400', 'D/ST':'text-cyan-400', K:'text-gray-400' };

    document.getElementById('modal-content').innerHTML = `
        <!-- Header Banner -->
        <div class="relative -m-8 mb-6 p-6 pb-8 overflow-hidden"
             style="background: linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(10,11,14,0) 70%);">
            <div class="absolute inset-0 opacity-5 text-[120px] oswald font-black leading-none overflow-hidden pointer-events-none select-none text-right pr-4 pt-2" style="color:#D4AF37">
                ${teamName.split(' ')[0]}
            </div>
            <div class="flex items-start gap-5 relative">
                <div class="w-20 h-20 md:w-24 md:h-24 bg-white/5 rounded-xl overflow-hidden border ${isGoldRank ? 'border-[#D4AF37]/40' : 'border-white/10'} flex-shrink-0 premium-shadow">
                    ${user?.avatar
                        ? `<img src="https://sleepercdn.com/avatars/${user.avatar}" class="w-full h-full object-cover">`
                        : `<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-shield-halved text-3xl text-gray-700"></i></div>`}
                </div>
                <div class="flex-1 min-w-0">
                    <h2 class="oswald text-2xl md:text-3xl uppercase italic leading-tight ${isGoldRank ? 'rank-gold' : ''}">${teamName}</h2>
                    <p class="text-[#D4AF37]/70 font-bold uppercase tracking-widest text-xs mono mt-0.5">@${user?.display_name || ''} · Est. ${dynInfo?.entered || '—'}</p>
                    ${getBadgesHTML(dynInfo, isChamp, isRelegation)}
                </div>
                ${dynRankNum ? `
                <div class="flex-shrink-0 text-right hidden md:block">
                    <span class="oswald text-4xl ${isGoldRank ? 'rank-gold' : 'text-gray-600'}">#${dynRankNum}</span>
                    <p class="text-[9px] mono uppercase tracking-widest text-gray-600">Dynasty Rank</p>
                </div>` : ''}
            </div>
        </div>

        <div class="flex flex-col md:flex-row gap-6">
            <!-- LEFT PANEL: Stats -->
            <div class="w-full md:w-80 flex-shrink-0 space-y-3">
                <div class="grid grid-cols-3 gap-2">
                    <div class="bg-white/5 rounded-lg p-3 text-center">
                        <span class="text-[9px] mono uppercase text-gray-500 block">W-L</span>
                        <span class="oswald text-lg">${roster.settings.wins}-${roster.settings.losses}</span>
                    </div>
                    <div class="bg-white/5 rounded-lg p-3 text-center">
                        <span class="text-[9px] mono uppercase text-gray-500 block">FPTS</span>
                        <span class="oswald text-lg">${roster.settings.fpts}</span>
                    </div>
                    <div class="bg-white/5 rounded-lg p-3 text-center">
                        <span class="text-[9px] mono uppercase text-gray-500 block">PA</span>
                        <span class="oswald text-lg">${roster.settings.fpts_against || '—'}</span>
                    </div>
                </div>

                <!-- Dynasty Score -->
                <div class="bg-white/5 rounded-lg p-4 ${isGoldRank ? 'border border-[#D4AF37]/20' : ''}">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[9px] mono uppercase text-gray-500 font-bold">Dynasty Score</span>
                        ${dynRankNum ? `<span class="dynasty-rank-pill ${isGoldRank ? 'gold' : 'default'}"><i class="fa-solid fa-ranking-star" style="font-size:8px"></i> #${dynRankNum}</span>` : ''}
                    </div>
                    <span class="oswald text-3xl ${dynScoreClass}">${dynScoreText}</span>
                    ${dynInfo?.winPct ? `<p class="text-[9px] mono text-gray-600 mt-1">Win % avg: ${dynInfo.winPct}</p>` : ''}
                    ${dynInfo?.breakdown ? `
                    <div class="mt-3 pt-2 border-t border-white/5 space-y-0.5">
                        ${DSCORE_LINE_ITEMS.filter(li => dynInfo.breakdown[li.key] && dynInfo.breakdown[li.key] !== 0).map(li => {
                            const val = dynInfo.breakdown[li.key];
                            const isNeg = li.key === 'relegated' || li.key === 'bottom4';
                            return `<div class="flex justify-between items-center">
                                <span class="text-[9px] mono text-gray-600">${li.label}</span>
                                <span class="text-[9px] mono font-bold ${isNeg ? 'text-red-500' : 'text-gray-400'}">${li.key === 'winPct' ? val + '%' : '×' + val}</span>
                            </div>`;
                        }).join('')}
                    </div>` : ''}
                </div>

                <!-- Immunity Badge -->
                ${immunityInfo ? `
                <div class="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-1">
                        <i class="fa-solid fa-crown text-emerald-400 text-xs immunity-badge"></i>
                        <span class="text-[9px] mono uppercase text-emerald-400 font-bold tracking-wider">Immunity Active</span>
                    </div>
                    <p class="text-xs text-emerald-300">${immunityInfo.reason}</p>
                    <p class="text-[9px] mono text-emerald-700 mt-1">Expires after ${immunityInfo.expires} season</p>
                </div>` : ''}

                <!-- Relegation Risk -->
                ${isRelegation ? `
                <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-1">
                        <i class="fa-solid fa-triangle-exclamation text-red-400 text-xs relegation-badge"></i>
                        <span class="text-[9px] mono uppercase text-red-400 font-bold tracking-wider">Relegation Zone</span>
                    </div>
                    <p class="text-xs text-red-300/70">Currently in the bottom relegation positions.</p>
                </div>` : ''}
            </div>

            <!-- RIGHT PANEL: Lineup -->
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="oswald text-lg uppercase tracking-wider">Active Lineup</h3>
                    ${matchup ? `<span class="text-[9px] mono uppercase text-gray-600 bg-white/5 px-2 py-1 rounded">Week ${activeLeagueData.week} · ${matchup.points.toFixed(1)} pts</span>` : ''}
                </div>
                <div class="space-y-1.5 mb-6">
                    ${positions.map((pos, i) => {
                        const pId = starters[i];
                        const p = playerMap ? playerMap[pId] : null;
                        const posColor = posColors[pos] || 'text-gray-400';
                        return `<div class="starter-slot flex items-center gap-3 p-2.5 bg-white/5 rounded-lg group">
                            <span class="w-12 text-[9px] font-black mono ${posColor} flex-shrink-0">${pos}</span>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold uppercase truncate">${p ? `${p.first_name} ${p.last_name}` : '<span class="text-gray-600 italic">Empty Slot</span>'}</p>
                                <p class="text-[9px] text-gray-500 uppercase mono">${p ? `${p.team || 'FA'} · ${p.position}` : ''}</p>
                            </div>
                            ${p ? `<span class="text-[9px] mono text-gray-600 flex-shrink-0 hidden group-hover:block">${p.status === 'Active' ? '' : p.status || ''}</span>` : ''}
                        </div>`;
                    }).join('')}
                </div>

                ${bench.length > 0 ? `
                <h3 class="oswald text-lg uppercase tracking-wider mb-3 text-gray-500">Bench <span class="text-[10px] mono text-gray-700">(${bench.length})</span></h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    ${bench.map(pId => {
                        const p = playerMap ? playerMap[pId] : null;
                        if (!p) return '';
                        const posColor = posColors[p.position] || 'text-gray-400';
                        return `<div class="p-2.5 bg-white/3 hover:bg-white/5 border border-white/5 rounded-lg transition-colors">
                            <p class="text-xs font-bold uppercase mono truncate">${p.first_name[0]}. ${p.last_name}</p>
                            <p class="text-[9px] text-gray-600 mono"><span class="${posColor}">${p.position}</span> · ${p.team || 'FA'}</p>
                        </div>`;
                    }).join('')}
                </div>` : ''}
            </div>
        </div>
    `;

    document.body.classList.add('modal-open');
    document.getElementById('team-modal').classList.remove('hidden');
}

/**
 * Closes the team detail modal.
 */
function closeModal() {
    document.getElementById('team-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// ─── RANKINGS TAB ───────────────────────────────────────────────────────────
/**
 * Renders the dynasty rankings table.
 */
function renderRankings() {
    const body = document.getElementById('rankings-body');
    body.innerHTML = '';
    [...DYNASTY_RANKS].sort((a, b) => b.score - a.score).forEach((item, i) => {
        const tr = document.createElement('tr');
        tr.className = `border-b border-white/5 hover:bg-white/5 transition-colors ${i === 0 ? 'bg-yellow-500/5' : ''}`;
        const isChamp = CHAMPION_TEAMS.includes(item.team);
        const scoreClass = item.score < 0 ? 'text-red-500' : (i === 0 ? 'rank-gold' : 'text-white');
        tr.innerHTML = `
            <td class="p-4 oswald text-xl mono ${i === 0 ? 'rank-gold' : ''}">${i + 1}</td>
            <td class="p-4">
                <p class="font-bold uppercase tracking-tight ${i === 0 ? 'rank-gold' : ''}">${item.team}</p>
                <p class="text-[10px] text-gray-600 mono">Est. ${item.entered || '—'}</p>
            </td>
            <td class="p-4 text-sm font-medium text-gray-400 mono">${item.winPct}</td>
            <td class="p-4 font-black italic mono ${scoreClass}">${item.score.toFixed(2)}</td>
            <td class="p-4">${getBadgesHTML(item, isChamp, false)}</td>
        `;
        body.appendChild(tr);
    });
}

// ─── RECORDS TAB ────────────────────────────────────────────────────────────
/**
 * Renders hall of fame and permanent records.
 */
function renderRecords() {
    document.getElementById('hall-of-fame-grid').innerHTML = `
        <div class="banner-champion p-6 rounded-xl text-left">
            <p class="text-xs uppercase text-yellow-500/50 mb-1 font-bold mono">2025 Season · Season 3</p>
            <h4 class="oswald text-2xl text-white">Southie Thunder Buddies</h4>
            <p class="text-xs text-gray-400 mono mt-1">Dan · Massachusetts · philosopherdan</p>
            <div class="mt-2 inline-block bg-black/40 px-2 py-1 rounded text-[10px] text-yellow-400 uppercase italic mono"><i class="fa-solid fa-certificate mr-1"></i>Green Jacket Champion</div>
        </div>
        <div class="banner-champion p-6 rounded-xl text-left">
            <p class="text-xs uppercase text-yellow-500/50 mb-1 font-bold mono">2024 Season · Season 2</p>
            <h4 class="oswald text-2xl text-white">Driftwood Broncos</h4>
            <p class="text-xs text-gray-400 mono mt-1">Shane · Florida · SloppyJoes</p>
            <div class="mt-2 inline-block bg-black/40 px-2 py-1 rounded text-[10px] text-yellow-400 uppercase italic mono"><i class="fa-solid fa-certificate mr-1"></i>Green Jacket Champion</div>
        </div>
        <div class="banner-champion p-6 rounded-xl text-left" style="background:linear-gradient(to bottom,#4a3800,#856400);">
            <p class="text-xs uppercase text-yellow-500/50 mb-1 font-bold mono">2023 Season · Season 1</p>
            <h4 class="oswald text-2xl text-white">Lake Champlain Champs</h4>
            <p class="text-xs text-gray-400 mono mt-1">Dylan · Vermont · dylanjstoll</p>
            <div class="mt-2 inline-block bg-black/40 px-2 py-1 rounded text-[10px] text-yellow-400 uppercase italic mono"><i class="fa-solid fa-certificate mr-1"></i>Gold Jacket Champion</div>
        </div>
    `;

    const grid = document.getElementById('records-grid');
    grid.innerHTML = '';
    DYNASTY_RECORDS.forEach(rec => {
        const cfg = ({ 'Single Game High Score': { icon: 'fa-fire', color: 'text-orange-500' }, 'Longest Winning Streak': { icon: 'fa-bolt', color: 'text-emerald-500' }, 'Single Season W/L': { icon: 'fa-star', color: 'text-yellow-400' }, 'Season Long High Score': { icon: 'fa-calculator', color: 'text-blue-500' } })[rec.label] || { icon: 'fa-medal', color: 'text-white' };
        const card = document.createElement('div');
        card.className = 'glass p-6 rounded-xl border-l-4 border-white/10 relative overflow-hidden';
        card.innerHTML = `
            <div class="absolute -right-4 -bottom-4 opacity-5 text-6xl"><i class="fa-solid ${cfg.icon}"></i></div>
            <span class="block text-[10px] uppercase text-gray-500 font-black tracking-widest mb-2 flex items-center gap-2 mono">
                <i class="fa-solid ${cfg.icon} ${cfg.color}"></i> ${rec.label}
            </span>
            <h5 class="oswald text-xl leading-tight mb-2">${rec.val}</h5>
            <p class="text-xs text-yellow-500/80 font-bold tracking-tighter uppercase mono">${rec.owner}</p>
        `;
        grid.appendChild(card);
    });
}

// ─── CONSTITUTION TAB ───────────────────────────────────────────────────────
/**
 * Renders the league constitution articles and amendments.
 */
function renderConstitution() {
    if (constitutionRendered) return;
    constitutionRendered = true;
    
    const container = document.getElementById('constitution-articles');
    container.innerHTML = '';
    
    CONSTITUTION.forEach(item => {
        const isAmendment = item.type === 'amendment';
        const div = document.createElement('div');
        div.className = `constitution-article ${isAmendment ? 'amendment' : ''} rounded-xl overflow-hidden`;
        div.dataset.id = item.id;
        div.dataset.text = (item.title + ' ' + item.content).toLowerCase();
        
        div.innerHTML = `
            <button onclick="toggleArticle('${item.id}')" class="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-white/3 transition-colors group">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAmendment ? 'bg-[#D4AF37]/50' : 'bg-white/30'}"></div>
                    <span class="oswald uppercase italic text-sm ${isAmendment ? 'text-[#D4AF37]/80' : 'text-white'} group-hover:text-white transition-colors">${item.title}</span>
                </div>
                <i class="fa-solid fa-chevron-right text-[10px] text-gray-600 transition-transform flex-shrink-0" id="con-chevron-${item.id}"></i>
            </button>
            <div class="constitution-body" id="con-body-${item.id}">
                <div class="px-6 pb-6 pt-1 text-sm text-gray-400 leading-relaxed border-t border-white/5">
                    ${item.content}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

/**
 * Toggles a constitution article open/closed.
 */
function toggleArticle(id) {
    const body = document.getElementById(`con-body-${id}`);
    const chevron = document.getElementById(`con-chevron-${id}`);
    body.classList.toggle('open');
    chevron.style.transform = body.classList.contains('open') ? 'rotate(90deg)' : '';
}

/**
 * Expands all constitution articles.
 */
function expandAllConstitution() {
    document.querySelectorAll('.constitution-body').forEach(el => el.classList.add('open'));
    document.querySelectorAll('[id^="con-chevron-"]').forEach(el => el.style.transform = 'rotate(90deg)');
}

/**
 * Collapses all constitution articles.
 */
function collapseAllConstitution() {
    document.querySelectorAll('.constitution-body').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('[id^="con-chevron-"]').forEach(el => el.style.transform = '');
}

/**
 * Searches/filters constitution articles.
 */
function filterConstitution(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('.constitution-article').forEach(el => {
        const match = !q || el.dataset.text.includes(q);
        el.style.display = match ? '' : 'none';
        if (match && q) {
            document.getElementById(`con-body-${el.dataset.id}`).classList.add('open');
            document.getElementById(`con-chevron-${el.dataset.id}`).style.transform = 'rotate(90deg)';
        }
    });
}


// ─── RENDER FUNCTIONS FOR PHASE 2 ──────────────────────────────────────────

function renderTradeLog() {
    const container = document.getElementById('trades-content');
    if (!TRADE_LOG || !TRADE_LOG.length) {
        container.innerHTML = '<p class="text-gray-500">No trades recorded yet</p>';
        return;
    }
    let html = '';
    [...TRADE_LOG].reverse().forEach(season => {
        html += `<div class="glass rounded-xl p-6 premium-shadow">
            <h3 class="oswald text-2xl uppercase mb-4 border-l-4 border-[#D4AF37] pl-4 text-white">Season ${season.season} (${season.year})</h3>
            <div class="space-y-3">`;
        season.trades.forEach(trade => {
            html += `<div class="bg-white/3 rounded p-4 border border-white/5 hover:border-[#D4AF37]/30 transition-colors">
                <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <div>
                        <p class="text-sm"><span class="font-bold text-[#D4AF37]">${trade.team1}</span> <span class="text-gray-600">↔</span> <span class="font-bold text-[#D4AF37]">${trade.team2}</span></p>
                        <p class="text-xs text-gray-500 mono mt-1">Week ${trade.week}</p>
                    </div>
                    <p class="text-sm text-gray-400">${trade.description}</p>
                </div>
            </div>`;
        });
        html += '</div></div>';
    });
    container.innerHTML = html;
}

function renderPlayoffBracket() {
    const container = document.getElementById('playoffs-content');
    if (!PLAYOFF_HISTORY || !PLAYOFF_HISTORY.length) {
        container.innerHTML = '<p class="text-gray-500">No playoff history recorded</p>';
        return;
    }
    let html = '';
    [...PLAYOFF_HISTORY].reverse().forEach(season => {
        html += `<div class="glass rounded-xl p-6 premium-shadow">
            <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 pb-6 border-b border-white/10">
                <div>
                    <p class="text-sm text-gray-500 uppercase mono mb-1">Season ${season.season}</p>
                    <h3 class="oswald text-2xl uppercase text-white">${season.year} Championship</h3>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500 uppercase mono">Champion</p>
                    <p class="oswald text-xl text-[#D4AF37] leading-tight">${season.champion}</p>
                </div>
            </div>
            <div class="space-y-3">`;
        season.bracket.forEach(match => {
            const winner1 = match.winner === match.team1;
            const winner2 = match.winner === match.team2;
            const team1Class = winner1 ? 'text-[#D4AF37] font-bold' : 'text-gray-400';
            const team2Class = winner2 ? 'text-[#D4AF37] font-bold' : 'text-gray-400';
            html += `<div class="bg-white/3 rounded p-4 border border-white/5">
                <p class="text-xs text-gray-600 uppercase mono mb-2 font-bold">${match.round} • Week ${match.week}</p>
                <div class="space-y-1">
                    <div class="flex justify-between items-center">
                        <span class="${team1Class}">${match.team1}</span>
                        <span class="text-sm font-bold text-gray-500">${match.score1}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="${team2Class}">${match.team2}</span>
                        <span class="text-sm font-bold text-gray-500">${match.score2}</span>
                    </div>
                </div>
            </div>`;
        });
        html += '</div></div>';
    });
    container.innerHTML = html;
}

function renderDraftHistory() {
    const container = document.getElementById('drafts-content');
    if (!DRAFT_HISTORY || !DRAFT_HISTORY.length) {
        container.innerHTML = '<p class="text-gray-500">No draft history recorded</p>';
        return;
    }
    let html = '';
    [...DRAFT_HISTORY].reverse().forEach(draft => {
        html += `<div class="glass rounded-xl p-6 premium-shadow">
            <div class="mb-6 pb-6 border-b border-white/10">
                <p class="text-sm text-gray-500 uppercase mono mb-1">Season ${draft.season} • ${draft.type} Draft</p>
                <h3 class="oswald text-2xl uppercase text-white">${draft.date}</h3>
                ${draft.notes ? `<p class="text-xs text-gray-600 mt-2">${draft.notes}</p>` : ''}
            </div>
            <div class="space-y-2">`;
        draft.topPicks.forEach(pick => {
            html += `<div class="flex gap-4 items-center bg-white/3 p-3 rounded-lg border border-white/5 hover:border-[#D4AF37]/20 transition-colors">
                <span class="text-[#D4AF37] font-bold text-lg mono w-10 flex-shrink-0">#${pick.pick}</span>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-white truncate">${pick.player || 'TBD'}</p>
                    <p class="text-xs text-gray-500 truncate">${pick.team}</p>
                </div>
                ${pick.note ? `<span class="text-xs text-gray-600 whitespace-nowrap flex-shrink-0">${pick.note}</span>` : ''}
            </div>`;
        });
        html += '</div></div>';
    });
    container.innerHTML = html;
}

function renderWaiverWire() {
    const container = document.getElementById('waivers-content');
    if (!WAIVER_LOG || !WAIVER_LOG.length) {
        container.innerHTML = '<p class="text-gray-500">No waiver activity recorded</p>';
        return;
    }
    let html = '';
    WAIVER_LOG.forEach(week => {
        html += `<div class="glass rounded-xl p-6 premium-shadow">
            <p class="text-sm font-bold text-[#D4AF37] uppercase mono mb-4">Week ${week.week} • ${week.date}</p>
            <div class="space-y-2">`;
        week.transactions.forEach(tx => {
            const isAdd = tx.type === 'add';
            const icon = isAdd ? '✓' : '✕';
            const color = isAdd ? 'text-green-400' : 'text-red-400';
            const bgColor = isAdd ? 'bg-green-500/10' : 'bg-red-500/10';
            const borderColor = isAdd ? 'border-green-500/20' : 'border-red-500/20';
            html += `<div class="bg-white/3 rounded p-3 border ${borderColor} ${bgColor}">
                <div class="flex gap-3 items-start">
                    <span class="${color} font-bold text-lg w-6 flex-shrink-0">${icon}</span>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-white">${tx.team}</p>
                        <p class="text-sm text-gray-400"><span class="${color} font-bold">${tx.player}</span> <span class="text-gray-600">(${tx.position})</span></p>
                        ${tx.dropped && tx.dropped !== 'None' ? `<p class="text-xs text-red-500 mt-1">Dropped: ${tx.dropped}</p>` : ''}
                    </div>
                </div>
            </div>`;
        });
        html += '</div></div>';
    });
    container.innerHTML = html;
}

function renderSeasonProjections() {
    const container = document.getElementById('projections-content');
    if (!SEASON_PROJECTIONS || !SEASON_PROJECTIONS.projections.length) {
        container.innerHTML = '<p class="text-gray-500">No projections available</p>';
        return;
    }
    const proj = SEASON_PROJECTIONS;
    const odds = PLAYOFF_ODDS;
    let html = `<div class="glass rounded-xl p-6 premium-shadow mb-8">
        <p class="text-sm text-gray-500 uppercase mono mb-2">Week ${proj.week} Projections</p>
        <p class="text-xs text-gray-600">Based on current standing and remaining schedule</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
            <h3 class="oswald text-xl uppercase font-bold border-l-4 border-[#D4AF37] pl-3">Projected Records</h3>`;
    proj.projections.forEach(p => {
        html += `<div class="glass p-4 rounded border border-white/5 hover:border-[#D4AF37]/30 transition-colors">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="font-bold text-white">${p.team}</p>
                    <p class="text-xs text-gray-600">${p.wins}W-${p.losses}L</p>
                </div>
                <div class="text-right">
                    <p class="oswald text-lg font-bold text-[#D4AF37]">${p.projectedRecord}</p>
                    <p class="text-xs text-gray-600">${p.confidence}% conf</p>
                </div>
            </div>
            <div class="bg-white/3 rounded h-1.5 overflow-hidden">
                <div class="h-full bg-[#D4AF37]" style="width: ${(p.wins / (p.wins + p.losses)) * 100}%"></div>
            </div>
        </div>`;
    });
    html += `</div>
        <div class="space-y-4">
            <h3 class="oswald text-xl uppercase font-bold border-l-4 border-green-400 pl-3">Playoff Odds</h3>`;
    odds.odds.forEach(o => {
        const safeMade = o.playoffProb >= 50 ? '✓ Safe' : (o.playoffProb >= 25 ? '⚠ Risky' : '✕ Unlikely');
        const safeColor = o.playoffProb >= 50 ? 'text-green-400' : (o.playoffProb >= 25 ? 'text-yellow-500' : 'text-red-500');
        html += `<div class="glass p-4 rounded border border-white/5 hover:border-green-400/30 transition-colors">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="font-bold text-white">${o.team}</p>
                    <p class="text-xs text-gray-600">Make Playoffs</p>
                </div>
                <div class="text-right">
                    <p class="oswald text-lg font-bold ${safeColor}">${o.playoffProb}%</p>
                    <p class="text-xs text-gray-600">${safeMade}</p>
                </div>
            </div>
            ${o.byeProb > 0 ? `<p class="text-xs text-yellow-600">First-round bye: ${o.byeProb}%</p>` : ''}
            <div class="bg-white/3 rounded h-1.5 overflow-hidden mt-2">
                <div class="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" style="width: ${o.playoffProb}%"></div>
            </div>
        </div>`;
    });
    html += `</div></div>`;
    container.innerHTML = html;
}


// ─── TAB SWITCHING ──────────────────────────────────────────────────────────
/**
 * Switches between different views/tabs.
 */
function switchTab(tab) {
    currentTab = tab;
    const views = ['live-view','rankings-view','records-view','history-view','constitution-view','trades-view','playoffs-view','drafts-view','projections-view','waivers-view'];
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById('header-section').classList.add('hidden');
    document.getElementById('dynasty-banner-section').classList.add('hidden');

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${tab}`).classList.add('active');

    if (tab === 'rankings') {
        document.getElementById('rankings-view').classList.remove('hidden');
        renderRankings();
    } else if (tab === 'records') {
        document.getElementById('records-view').classList.remove('hidden');
        renderRecords();
    } else if (tab === 'history') {
        document.getElementById('history-view').classList.remove('hidden');
    } else if (tab === 'constitution') {
        document.getElementById('constitution-view').classList.remove('hidden');
        renderConstitution();
    } else if (tab === 'trades') {
        document.getElementById('trades-view').classList.remove('hidden');
        renderTradeLog();
    } else if (tab === 'playoffs') {
        document.getElementById('playoffs-view').classList.remove('hidden');
        renderPlayoffBracket();
    } else if (tab === 'drafts') {
        document.getElementById('drafts-view').classList.remove('hidden');
        renderDraftHistory();
    } else if (tab === 'projections') {
        document.getElementById('projections-view').classList.remove('hidden');
        renderSeasonProjections();
    } else if (tab === 'waivers') {
        document.getElementById('waivers-view').classList.remove('hidden');
        renderWaiverWire();
    } else {
        document.getElementById('live-view').classList.remove('hidden');
        document.getElementById('header-section').classList.remove('hidden');
        document.getElementById('dynasty-banner-section').classList.remove('hidden');
        document.getElementById('tier-title').innerText = LEAGUE_MAP[tab].name.toUpperCase();
        document.getElementById('tier-subtitle').innerText = LEAGUE_MAP[tab].subtitle;
        document.getElementById('team-count').innerText = `${LEAGUE_MAP[tab].capacity} TEAMS`;
        loadLeagueData(tab);
    }
}

// ─── MODAL CLOSE HANDLER ────────────────────────────────────────────────────
window.onclick = (e) => {
    if (e.target.id === 'team-modal') closeModal();
};

// ─── INITIALIZATION ────────────────────────────────────────────────────────
/**
 * Initialize the app on page load.
 */
window.onload = async () => {
    await fetchPlayerMap();
    switchTab('top');
};

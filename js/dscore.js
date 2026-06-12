// ═════════════════════════════════════════════════════════════════════════
//  IT'S THE CLIMB — AUTO D-SCORE ENGINE
//  Computes Amendment I dynasty scoring from Sleeper season history.
//  Slot-proof: every season credited to that season's owner_id.
//  Manual-only inputs (record bonuses, adjustments) come from DYNASTY_RANKS.
// ═════════════════════════════════════════════════════════════════════════

const DSCORE_PTS = {
    champ: 100, secondPlace: 50, thirdPlace: 25, playoffs: 25, playoffWin: 20,
    divWin: 50, ptsFirst: 50, ptsSecond: 25, bottom4: -50, ptsLast: -10,
    escape: 75, returnFromReleg: 100, relegated: -25, b2b: 25, seasonsTop: 10,
    lvl2Champ: 20, lvl2Pts: 15, lvl3Champ: 10, lvl3Pts: 5
};

const AUDIT_ITEMS = [
    { key: 'champ',           label: 'Championships',          manual: 'champ' },
    { key: 'secondPlace',     label: '2nd Place',              manual: 'secondPlace' },
    { key: 'thirdPlace',      label: '3rd Place',              manual: 'thirdPlace' },
    { key: 'playoffs',        label: 'Playoff Appearances',    manual: 'playoffs' },
    { key: 'playoffWin',      label: 'Playoff Wins',           manual: 'playoffWin' },
    { key: 'divWin',          label: 'Division Wins',          manual: 'divWin' },
    { key: 'ptsFirst',        label: 'Points Leader',          manual: 'ptsFirst' },
    { key: 'ptsSecond',       label: '2nd in Points',          manual: 'ptsSecond' },
    { key: 'bottom4',         label: 'Bottom 4 Finish',        manual: 'bottom4' },
    { key: 'ptsLast',         label: 'Last in Points',         manual: 'ptsLast' },
    { key: 'escape',          label: 'Escaped Relegation',     manual: 'escape' },
    { key: 'returnFromReleg', label: 'Return from Relegation', manual: 'returnFromReleg' },
    { key: 'relegated',       label: 'Relegations',            manual: 'relegated' },
    { key: 'b2b',             label: 'Back-to-Back Champ',     manual: 'b2b' },
    { key: 'seasonsTop',      label: 'Seasons in Top Level',   manual: 'seasonsTop' },
    { key: 'lvl2Champ',       label: 'Level 2 Champion',       manual: 'lvl2Champ' },
    { key: 'lvl2Pts',         label: 'Level 2 Point Champ',    manual: 'lvl2Pts' },
    { key: 'lvl3Champ',       label: 'Level 3 Champion',       manual: 'lvl3Champ' },
    { key: 'lvl3Pts',         label: 'Level 3 Point Champ',    manual: 'lvl3Pts' }
];

function computeDScores(hist) {
    const canon = id => {
        const r = DYNASTY_RANKS.find(d => d.ownerId === id || (d.aliasIds || []).includes(id));
        return r ? r.ownerId : id;
    };
    const owners = {};
    const O = id => owners[id] ||= { comp: Object.fromEntries(AUDIT_ITEMS.map(i => [i.key, 0])),
                                     winPcts: [], notes: [], champYears: [] };

    // presence map: year -> ownerId -> tier
    const presence = {};
    TIER_ORDER.forEach(tier => (hist[tier] || []).forEach(s => s.teams.forEach(t => {
        if (!t.ownerId) return;
        (presence[s.season] ||= {})[canon(t.ownerId)] = tier;
    })));
    const years = Object.keys(presence).map(Number).sort();

    // ── per-season awards ──
    TIER_ORDER.forEach(tier => (hist[tier] || []).forEach(s => {
        const isTop = tier === 'top';
        // seasons-in-top counts current season too; everything else needs a finished season
        if (isTop) s.teams.forEach(t => { if (t.ownerId) O(canon(t.ownerId)).comp.seasonsTop++; });
        // win% per played top season (live seasons count once games exist)
        if (isTop) s.teams.forEach(t => {
            const g = t.wins + t.losses + t.ties;
            if (t.ownerId && g > 0) O(canon(t.ownerId)).winPcts.push(t.wins / g * 100);
        });
        if (!s.complete) return;

        const byPts = [...s.teams].sort((a, b) => b.fpts - a.fpts);
        if (isTop) {
            if (byPts[0]?.ownerId) { O(canon(byPts[0].ownerId)).comp.ptsFirst++; }
            if (byPts[1]?.ownerId) { O(canon(byPts[1].ownerId)).comp.ptsSecond++; }
            const last = byPts[byPts.length - 1];
            if (last?.ownerId) O(canon(last.ownerId)).comp.ptsLast++;
            // bottom 4 by regular-season standing
            s.teams.filter(t => t.standing > s.teams.length - 4).forEach(t => {
                if (t.ownerId) O(canon(t.ownerId)).comp.bottom4++;
            });
            // division winners
            const divs = {};
            s.teams.forEach(t => { if (t.division) (divs[t.division] ||= []).push(t); });
            Object.values(divs).forEach(list => {
                const w = [...list].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts)[0];
                if (w?.ownerId) O(canon(w.ownerId)).comp.divWin++;
            });
        } else if (byPts[0]?.ownerId) {
            O(canon(byPts[0].ownerId)).comp[tier === 'mid' ? 'lvl2Pts' : 'lvl3Pts']++;
        }

        // bracket awards
        if (s.bracket?.length) {
            const ridOwner = rid => { const t = s.teams.find(x => x.rosterId === rid); return t?.ownerId ? canon(t.ownerId) : null; };
            const participants = new Set();
            s.bracket.forEach(m => [m.t1, m.t2].forEach(r => { if (typeof r === 'number') participants.add(r); }));
            const final = s.bracket.find(m => m.p === 1);
            const third = s.bracket.find(m => m.p === 3);
            if (isTop) {
                participants.forEach(rid => { const o = ridOwner(rid); if (o) O(o).comp.playoffs++; });
                s.bracket.forEach(m => { // wins in real playoff games (not consolation placement games)
                    if ((m.p === undefined || m.p === 1) && typeof m.w === 'number') {
                        const o = ridOwner(m.w); if (o) O(o).comp.playoffWin++;
                    }
                });
                if (final && typeof final.w === 'number') {
                    const cw = ridOwner(final.w), cl = ridOwner(final.l);
                    if (cw) { O(cw).comp.champ++; O(cw).champYears.push(s.season); }
                    if (cl) O(cl).comp.secondPlace++;
                }
                if (third && typeof third.w === 'number') {
                    const o = ridOwner(third.w); if (o) O(o).comp.thirdPlace++;
                }
            } else if (final && typeof final.w === 'number') {
                const o = ridOwner(final.w);
                if (o) O(o).comp[tier === 'mid' ? 'lvl2Champ' : 'lvl3Champ']++;
            }
        }
    }));

    // ── cross-season movements (top tier) ──
    const topSeasons = (hist.top || []).slice().sort((a, b) => a.season - b.season);
    Object.keys(owners).forEach(id => {
        const o = owners[id];
        let everTop = false, wasRelegated = false;
        years.forEach((y, i) => {
            const tier = presence[y][id];
            const next = years[i + 1] ? presence[years[i + 1]][id] : undefined;
            const seasonObj = topSeasons.find(s => s.season === y);
            if (tier === 'top') {
                if (everTop && wasRelegated && years[i - 1] !== undefined && presence[years[i - 1]][id] && presence[years[i - 1]][id] !== 'top') {
                    o.comp.returnFromReleg++; wasRelegated = false;
                }
                everTop = true;
                if (seasonObj?.complete && next !== undefined) {
                    const team = seasonObj.teams.find(t => t.ownerId && canon(t.ownerId) === id);
                    const inBottom4 = team && team.standing > seasonObj.teams.length - 4;
                    if (next !== 'top') { o.comp.relegated++; wasRelegated = true; }
                    else if (inBottom4) o.comp.escape++;
                }
            }
        });
        // back-to-back championships
        o.champYears.sort();
        for (let i = 1; i < o.champYears.length; i++)
            if (o.champYears[i] === o.champYears[i - 1] + 1) o.comp.b2b++;
    });

    // ── totals ──
    const result = {};
    Object.entries(owners).forEach(([id, o]) => {
        let pts = 0;
        Object.entries(o.comp).forEach(([k, n]) => pts += (DSCORE_PTS[k] || 0) * n);
        const avgWinPct = o.winPcts.length ? o.winPcts.reduce((a, b) => a + b, 0) / o.winPcts.length : 0;
        const dyn = DYNASTY_RANKS.find(d => d.ownerId === id);
        const manualBonus = (dyn?.breakdown?.permRecordBonus || 0) + (dyn?.breakdown?.recordBonus || 0) + (dyn?.manualAdjust || 0);
        result[id] = { comp: o.comp, avgWinPct, basePts: pts, manualBonus,
                       total: pts + avgWinPct + manualBonus };
    });
    return result;
}

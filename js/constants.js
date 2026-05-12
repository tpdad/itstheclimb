// ─── SLEEPER API LEAGUE CONFIGURATION ───────────────────────────────────────
// These IDs map directly to your Sleeper league accounts
const LEAGUE_MAP = {
    top:    { id: '1312154762648506368', name: 'The Top Level',  subtitle: 'Green Jacket & Gold Jacket Divisions', capacity: 12, color: '#D4AF37' },
    mid:    { id: '1312155068753006592', name: 'The Mid League', subtitle: 'Jimmy & Malcolm Divisions',            capacity: 12, color: '#C0C0C0' },
    cellar: { id: '1312155365764263936', name: 'The Cellar',     subtitle: 'Roy McAvoy & Roy Munson Divisions',    capacity: 10, color: '#8B4513' }
};

// ─── PERMANENT RECORDS ───────────────────────────────────────────────────────
const DYNASTY_RECORDS = [
    { label: 'Single Game High Score',   owner: 'Point Pleasant Mothmen',  val: '234.6' },
    { label: 'Longest Winning Streak',   owner: 'Southie Thunder Buddies', val: '14 Games' },
    { label: 'Single Season W/L',        owner: 'Southie Thunder Buddies', val: '15-1' },
    { label: 'Season Long High Score',   owner: 'Southie Thunder Buddies', val: '2442.99' }
];

// ─── DYNASTY RANKINGS (Update manually each season) ───────────────────────────
// These are maintained manually. Update the scores, breakdown, and bonuses as the dynasty progresses.
const DYNASTY_RANKS = [
    { team: 'Southie Thunder Buddies',    owners: ['philosopherdan','daniel frank'], score: 384.00, winPct: '74%', bonus: 'Division, Total Points, Streak, Single Season W/L',
      entered: 2023, breakdown: { champ:1, thirdPlace:1, ptsFirst:2, playoffs:3, divWin:2, playoffWin:2, winPct:74, seasonsTop:4, permRecordBonus:10, recordBonus:100 } },
    { team: 'Lake Champlain Champs',      owners: [],                                score: 205.75, winPct: '57%', bonus: 'Championship',
      entered: 2023, breakdown: { champ:1, playoffs:3, playoffWin:3, winPct:57, seasonsTop:4 } },
    { team: 'Point Pleasant Mothmen',     owners: ['che','chemistbee'],              score: 204.00, winPct: '64%', bonus: 'High Score Holder',
      entered: 2025, breakdown: { ptsSecond:1, playoffs:1, lvl2Champ:1, winPct:64, seasonsTop:2, permRecordBonus:10, recordBonus:25 } },
    { team: 'New England Blinkahs',       owners: ['tutes1173'],                     score: 197.50, winPct: '60%', bonus: 'History',
      entered: 2023, breakdown: { secondPlace:1, ptsFirst:1, playoffs:1, divWin:1, playoffWin:1, relegated:1, winPct:60, seasonsTop:4, permRecordBonus:5 } },
    { team: 'Mar a Lago Bed Bugs',        owners: ['happpy'],                        score: 184.17, winPct: '50%', bonus: '-',
      entered: 2024, breakdown: { winPct:50, seasonsTop:3 } },
    { team: 'Bikini Bottom Angry Birds',  owners: [],                                score: 180.17, winPct: '46%', bonus: 'Division',
      entered: 2023, breakdown: { divWin:1, winPct:46, seasonsTop:3 } },
    { team: "The Catalina Wine Mixer's",  owners: [],                                score: 179.83, winPct: '64%', bonus: '-',
      entered: 2024, breakdown: { winPct:64, seasonsTop:3 } },
    { team: 'Driftwood Broncos',          owners: ['sloppyjoes'],                    score: 143.17, winPct: '39%', bonus: 'Championship',
      entered: 2024, breakdown: { champ:1, winPct:39, seasonsTop:3 } },
    { team: 'Wukanda dolphins',           owners: ['minic'],                         score: 140.83, winPct: '50%', bonus: '-',
      entered: 2024, breakdown: { winPct:50, seasonsTop:3 } },
    { team: 'Mooloolaba Love Tanks',      owners: ['steaminwilliebeamens'],          score: 97.50,  winPct: '50%', bonus: '-',
      entered: 2023, breakdown: { winPct:50, seasonsTop:2, relegated:1 } },
    { team: 'Rhody Quahogs',              owners: ['squirtlesquad187'],              score: 81.00,  winPct: '61%', bonus: '-',
      entered: 2023, breakdown: { winPct:61, seasonsTop:2, relegated:1 } },
    { team: 'CT Cool Catz',               owners: ['plak13'],                        score: 61.50,  winPct: '54%', bonus: '-',
      entered: 2023, breakdown: { winPct:54, seasonsTop:2, relegated:1 } },
    { team: 'Lone Star Legends',          owners: ['cbabybell'],                     score: 42.50,  winPct: '0%',  bonus: '-',
      entered: 2026, breakdown: { winPct:0, seasonsTop:1 }, sloppyException: false },
    { team: 'Manitoba MooseKnuckles',     owners: ['cellyl77'],                      score: 42.50,  winPct: '0%',  bonus: '-',
      entered: 2026, breakdown: { winPct:0, seasonsTop:1 } },
    { team: 'Washington WarHawks',        owners: ['lokisam'],                       score: 38.00,  winPct: '33%', bonus: '-',
      entered: 2023, breakdown: { winPct:33, seasonsTop:2, relegated:1 } },
    { team: 'New York Red Hulks',         owners: ['dynastyghoul'],                  score: 32.50,  winPct: '0%',  bonus: '-',
      entered: 2026, breakdown: { winPct:0, seasonsTop:1 } },
    { team: 'Puddletown Panthers',        owners: ['christiandior23'],               score: 16.00,  winPct: '0%',  bonus: '-',
      entered: 2025, breakdown: { winPct:0, seasonsTop:1 } },
    { team: 'London Silly Nannies',       owners: ['ryguy5188'],                     score: -22.00, winPct: '43%', bonus: '-',
      entered: 2025, breakdown: { winPct:43, seasonsTop:1, relegated:1 } },
    { team: 'The Bog Cloggers',           owners: ['aidanwhite234'],                 score: -83.00, winPct: '7%',  bonus: '-',
      entered: 2025, breakdown: { winPct:7, seasonsTop:1, relegated:1, bottom4:1 } }
];

// ─── BADGE & ACHIEVEMENT DEFINITIONS ─────────────────────────────────────────
const CHAMPION_TEAMS = ['Southie Thunder Buddies', 'Driftwood Broncos', 'Lake Champlain Champs'];
const RECORD_HOLDER_TEAMS = ['Point Pleasant Mothmen', 'Southie Thunder Buddies'];
const IMMUNITY_TEAMS_DATA = [
    { team: 'Southie Thunder Buddies', owner: 'philosopherdan', expires: 2026, reason: '2025 Champion' }
];
const IMMUNITY_TEAMS = IMMUNITY_TEAMS_DATA.map(i => i.team);

// ─── RELEGATION RISK (teams at bottom of standings) ──────────────────────────
const RELEGATION_RISK_COUNT = { top: 2, mid: 2, cellar: 0 };

// ─── BADGE ICONS & STYLING ──────────────────────────────────────────────────
const RECORD_BADGES = {
    'Championship':          { icon: 'fa-trophy',              color: 'text-yellow-500',  bg: 'bg-yellow-500/20' },
    'High Score Holder':     { icon: 'fa-fire',                color: 'text-orange-500',  bg: 'bg-orange-500/20' },
    'Total Points':          { icon: 'fa-calculator',          color: 'text-blue-500',    bg: 'bg-blue-500/20'   },
    'Streak':                { icon: 'fa-bolt',                color: 'text-emerald-500', bg: 'bg-emerald-500/20'},
    'Single Season W/L':     { icon: 'fa-star',                color: 'text-yellow-400',  bg: 'bg-yellow-400/20' },
    'Division':              { icon: 'fa-crown',               color: 'text-purple-500',  bg: 'bg-purple-500/20' },
    'History':               { icon: 'fa-book',                color: 'text-white',       bg: 'bg-white/20'      },
    'Relegation Risk':       { icon: 'fa-triangle-exclamation',color: 'text-red-500',     bg: 'bg-red-500/20'    }
};

// ─── D-SCORE CALCULATION COMPONENTS ──────────────────────────────────────────
// These define how dynasty points are calculated from season performance
const DSCORE_LINE_ITEMS = [
    { key: 'champ',           label: 'Championship',         pts: '+100/ea' },
    { key: 'secondPlace',     label: '2nd Place',            pts: '+50/ea'  },
    { key: 'thirdPlace',      label: '3rd Place',            pts: '+25/ea'  },
    { key: 'playoffs',        label: 'Playoff Appearances',  pts: '+25/ea'  },
    { key: 'playoffWin',      label: 'Playoff Wins',         pts: '+20/ea'  },
    { key: 'divWin',          label: 'Division Wins',        pts: '+50/ea'  },
    { key: 'ptsFirst',        label: 'Points Leader (Ssn)',  pts: '+50/ea'  },
    { key: 'ptsSecond',       label: '2nd in Points (Ssn)',  pts: '+25/ea'  },
    { key: 'winPct',          label: 'Win % (avg × 1)',      pts: 'avg'     },
    { key: 'seasonsTop',      label: 'Seasons in Top Lvl',   pts: '+10/ea'  },
    { key: 'relegated',       label: 'Relegation',           pts: '-25/ea'  },
    { key: 'bottom4',         label: 'Bottom 4 Finish',      pts: '-50/ea'  },
    { key: 'permRecordBonus', label: 'Perm. Record Bonus',   pts: 'static'  },
    { key: 'recordBonus',     label: 'Record Holder Bonus',  pts: 'static'  },
    { key: 'lvl2Champ',       label: 'Level 2 Champion',     pts: '+20/ea'  }
];

// ─── LEAGUE CONSTITUTION & AMENDMENTS ────────────────────────────────────────
// Update this when you make changes to the constitution
const CONSTITUTION = [
    { id: 'art1', type: 'article', title: 'Article I: Governing Body', content: `The league commissioner is Daniel Frank. Commissioner has autonomous rule and final say on all league matters. No decision can be overruled by democratic vote. Appeals are heard by the office of the commissioner — there is no appeal of the appeal. The commissioner serves until bribed sufficiently or resigned voluntarily (triggering a democratic election).` },
    { id: 'art2', type: 'article', title: 'Article II: League Setup', content: `It's the Climb is a blend of dynasty, keeper, and relegation league. Three tiers: Top, Mid, and Cellar. Each league has two divisions. Teams play divisional opponents twice and non-divisional opponents once. No fees currently — "love of the game" model. Potential for more levels in future years.` },
    { id: 'art3', type: 'article', title: 'Article III: League Members', content: `12 members in Top and Mid leagues; 10 in the Cellar. Members retain their franchise while in good standing. Vacated teams enter dispersal draft. New members may be added by the commissioner.` },
    { id: 'art4', type: 'article', title: 'Article IV: Amendments', content: `Amendments via democratic vote (majority of votes cast) or commissioner decree. In-season amendments apply to the following season unless deemed urgent by commissioner. All amendments named after the member who caused or identified the issue. Stored on Google Drive.` },
    { id: 'art5', type: 'article', title: 'Article V: Draft', content: `All drafts held online via Sleeper. "Slow draft" format: 12-hour pick clock, paused 8PM–8AM. Startup draft is randomized snake order. Annual rookie/veteran draft order based on dynasty rankings (lowest rank = first pick). Mid and Cellar randomized, with #1 pick to Cellar loser's bracket winner. Auto-drafters forfeit all complaint rights.` },
    { id: 'art6', type: 'article', title: 'Article VI: Waivers', content: `Free agency opens immediately after the draft. Standard Sleeper waiver priority (claim = move to bottom). No acquisition limit. Teams eliminated from playoffs cannot pick up players, except for lineup emergencies or if still fighting relegation.` },
    { id: 'art7', type: 'article', title: 'Article VII: Trades', content: `Trades open after championship game, close near start of final regular season week. No eliminated team may trade after Week 12 (eliminated teams may trade with each other). No review period — integrity system. Collusion = commissioner review. Lopsided trades are allowed but subject to public shaming. Pick trading: only rounds 1–3 during season. No draft pick trading below Top Level.` },
    { id: 'art8', type: 'article', title: 'Article VIII: Regular Season', content: `Regular season runs through NFL Week 14. Auto-generated schedule via Sleeper. All teams must field valid lineups. Lineups lock at individual game time. No tiebreaker settings — fractional scoring prevents most ties.` },
    { id: 'art9', type: 'article', title: 'Article IX: Mid & Cellar Leagues', content: `Simpler rules: 18 keepers with no restrictions, no force drops, no "too many good players" rule, no draft pick trading, no dynasty ranking tracking. Designed to accommodate high turnover at lower levels.` },
    { id: 'art10', type: 'article', title: 'Article X: Playoffs & First Place', content: `6-team playoffs. Division winners get first-round bye. 4 remaining spots by record. Top scorer outside top 6 by record bumps the 6th-place team. Playoffs in NFL Weeks 15–17. Champion wins the It's the Climb Trophy + immunity from next season's relegation. Back-to-back champion earns a "get out of relegation" card usable anytime.` },
    { id: 'art11', type: 'article', title: 'Article XI: Promotion & Relegation', content: `4 teams typically relegated/promoted per season (minimum 2). Retired/banned teams relegated first. Complex relegation playoff spanning Weeks 15–17 involving seeds 1–2 (protection format) and bottom 4 head-to-head. Week 17 survival requires outscoring 6 teams. Immunity teams create bracket adjustments. Commissioner has full discretion.` },
    { id: 'art12', type: 'article', title: 'Article XII: Keepers', content: `18 players can be kept. Non-retained players enter the draft pool. Keeper deadline is typically around the NFL Draft. No kickers or DSTs may be kept. See Amendments IV & V for additional rules.` },
    { id: 'art13', type: 'article', title: 'Article XIII: League Owners', content: `Active Top Level: Dan (STB), Dylan (LCC), Mark (NEB), Sam (BBAB), Kevin (TCWM), Brian (MLB), Christian (WD), Shane (DB), Curtis (PPM), CellyL77 (MMK), cbabybell (LSL), DynastyGhoul (NYRH). Relegated: Plak13, SteaminWillieBeamens, SquirtleSquad187, AidanWhite234, ryguy5188, Lokisam. Retired: Robert (Honorable), Steve (Honorable), Danny (OTH), LP (OTH), RWeir (OTH).` },
    { id: 'amend1', type: 'amendment', title: 'Amendment I: Dynasty Rankings', content: `Per-season scoring: Championship +100, 2nd Place +50, 3rd Place +25, Make Playoffs +25, Playoff Win +20, Division Win +50, Points Leader +50, 2nd in Points +25, Bottom 4 -50, Last in Points -10, Escape Relegation +75, Return from Relegation +100, Relegation -25, Back-to-Back Champ +25. Added points: Top Level season +10, Level 2 Champ +20, Level 3 Champ +10, Record Holder +25 (active) / +5 (lost). Win % × 1 averaged per season. Dynasty Rank #1 earns relegation protection and first waiver priority.` },
    { id: 'amend2', type: 'amendment', title: 'Amendment II: Total Victory (Dynasty Victor)', content: `The Dynasty Rankings leader at the end of each "draft cycle" is crowned Dynasty Victor. The time period is named after them (e.g., "The [Name] Dynasty"). Perks: official recognition, trophy/ring, bonus points in next dynasty, immunity from relegation in following draft cycle, can never drop below Level 2. 2nd and 3rd place earn 2 seasons immunity in new draft cycle.` },
    { id: 'amend3', type: 'amendment', title: 'Amendment III: All Good Things Come to an End', content: `Redraft triggers: (1) One team wins more than half the championships after Year 4 + majority vote, (2) Two teams hold 6 combined championships + majority vote, (3) Season 10 vote, (4) Previously relegated team wins after Year 5 + 5-vote majority, (5) Promoted team wins in first season after Year 7 + 5-vote majority, (6) New winner after Year 10 — automatic redraft, (7) Team sweeps all three levels. Redraft resets dynasty rankings with carry-over bonuses (50/40/35… to last).` },
    { id: 'amend4', type: 'amendment', title: 'Amendment IV: Keeping it Interesting', content: `Force-drop system based on season finish. Championship finalists: 12pts to drop, 2nd round playoff losers: 10pts, 1st round playoff losers: 8pts, others: 6pts. Player tier points: Tier 1 = 10pts, Tier 2 = 8pts … Tier 9 = 1pt. Draft pick credits toward drops: 1st = 6pts, 2nd = 4pts, 3rd = 2pts. Teams without 8 tiered players use top 8 with untiered = 1pt each.` },
    { id: 'amend5', type: 'amendment', title: 'Amendment V: Keepers & Draft (TMGP)', content: `"Too Many Good Players" defined as: 2+ Tier 1 RBs/WRs/QBs/TEs, 3+ Tier 2 RBs/WRs/QBs, or 4+ Tier 3 RBs/WRs/QBs. Forfeits top draft pick + possible luxury tax. Compensatory picks awarded for voluntarily dropping elite players (Tier 1 RB/WR → 1st rounder, etc.). Top pick locks at offseason start.` },
    { id: 'amend6', type: 'amendment', title: 'Amendment VI: Vulgarity Conduct Code', content: `Gentleman/ladylike conduct expected (exceptions for humor and "drunken commentary"). Team names must be clean enough for workplace visibility. Violations result in commissioner-determined penalties (draft picks, name changes, community service). Repeat offenders may be banned from chat.` },
    { id: 'amend7', type: 'amendment', title: 'Amendment VII: I Did My Best', content: `Mistakes happen. This league is meant to be fun. Intent > technicality. Errors in the constitution or operations will be corrected in the best interest of the league.` },
    { id: 'amend8', type: 'amendment', title: 'Amendment VIII: Tis But a Scratch', content: `If the NFL launches an injury investigation into a player with no injury designation, the owner may seek retribution: a position-for-position roster swap (no further changes). Highest projected available player is the default. Must be flagged to commissioner before game activity.` },
    { id: 'amend9', type: 'amendment', title: 'Amendment IX: A Team Has No Name', content: `Team names must include a location + mascot/nickname (real or fictional). Names are meant to be permanent for branding and historical identity. Commissioner has final authority on compliance. Goal: build a league with enough lore that teams have legends. No overly vulgar names (workplace-visible standard applies).` },
    { id: 'amend10', type: 'amendment', title: 'Amendment X: The Sloppy Exception', content: `Commissioner may promote a non-performing team based on participation level and likability to fill vacancies not created by normal circumstances. Usable once per dynasty per owner. Owner must be in good standing. Lower-level commissioner is consulted. This is the exception, not the norm.` }
];

// ═════════════════════════════════════════════════════════════════════════
//  IT'S THE CLIMB — ARCADE: ENDZONE RUN (top-down, Tecmo-style)
//  Madden-style kick meter: tap = lock the sweeping arrow, tap = lock power.
//  RB: 30yd max, breaks 2 tackles · TE: 40yd, breaks 1 · WR: 60yd, breaks 0.
//  Ball advances to the spot of each tackle. KO'd defenders stay down.
//  Campaign = live dynasty ladder. Pixel sprites in icons/arcade/.
// ═════════════════════════════════════════════════════════════════════════

// Standalone team ladder — synced manually from the league's dynasty rankings.
// (When re-integrated into the site, replace with the live DYNASTY_RANKS array.)
const ER_TEAMS = [
    { team: 'The Bog Cloggers',          score: -83.00, ownerId: '868646780299010048', color: '#2D5A27', color2: '#654321' },
    { team: 'London Silly Nannies',      score: -22.00, ownerId: '815024153592745984', color: '#FFB6C1', color2: '#FFFFFF' },
    { team: 'Puddletown Panthers',       score: 16.00,  ownerId: '721895832546390016', color: '#4B0082', color2: '#000000' },
    { team: 'New York Red Hulks',        score: 32.50,  ownerId: '1078334787837829120', color: '#CC0000', color2: '#00CC00' },
    { team: 'Washington WarHawks',       score: 38.00,  ownerId: '867232149391265792', color: '#7A0016', color2: '#FFB612' },
    { team: 'Manitoba MooseKnuckles',    score: 42.50,  ownerId: '859484510746681344', color: '#000080', color2: '#C0C0C0' },
    { team: 'Lone Star Legends',         score: 42.50,  ownerId: '893945727754317824', color: '#002244', color2: '#B0B7BC' },
    { team: 'CT Cool Catz',              score: 61.50,  ownerId: '547635526044360704', color: '#00FFFF', color2: '#000000' },
    { team: 'Rhody Quahogs',             score: 81.00,  ownerId: '818613649684946944', color: '#A9A9A9', color2: '#006994' },
    { team: 'Mooloolaba Love Tanks',     score: 97.50,  ownerId: '607155371257163776', color: '#FF00FF', color2: '#FF1493' },
    { team: 'Wukanda dolphins',          score: 140.83, ownerId: '996510865815953408', color: '#008E97', color2: '#F26A24' },
    { team: 'Driftwood Broncos',         score: 143.17, ownerId: '337735453614567424', color: '#FB4F14', color2: '#002244' },
    { team: "The Catalina Wine Mixer's", score: 179.83, ownerId: '578735109004378112', color: '#722F37', color2: '#FFD700' },
    { team: 'Bikini Bottom Angry Birds', score: 180.17, ownerId: '867150076190052352', color: '#FFFF00', color2: '#FF0000' },
    { team: 'Mar a Lago Bed Bugs',       score: 184.17, ownerId: '996516356587753472', color: '#CFB53B', color2: '#8B0000' },
    { team: 'New England Blinkahs',      score: 197.50, ownerId: '399425495596290048', color: '#002244', color2: '#C60C30' },
    { team: 'Point Pleasant Mothmen',    score: 204.00, ownerId: '846183516587806720', color: '#111111', color2: '#FF0000' },
    { team: 'Lake Champlain Champs',     score: 205.75, ownerId: '310953370741407744', color: '#006400', color2: '#FFFFFF' },
    { team: 'Southie Thunder Buddies',   score: 384.00, ownerId: '368921092460462080', color: '#2E8B57', color2: '#FFC125' }
];

const ARCADE = (() => {
    const { Engine, World, Bodies, Body, Composite, Events, Vector } = Matter;

    const SUMMIT_LOCK = '368921092460462080';
    const TAUNTS = ['The goal line does not yield.', 'The Thunder Buddies always win.',
                    'Commissioner’s forecast: 100% chance of defeat.', 'You cannot outrun the bears.'];
    const RUNNERS = {
        rb: { label: 'RB', maxYd: 30, breaks: 2, color: '#7B4FA0', desc: '30 yd power · breaks 2 tackles' },
        te: { label: 'TE', maxYd: 40, breaks: 1, color: '#2E86D0', desc: '40 yd power · breaks 1 tackle' },
        wr: { label: 'WR', maxYd: 60, breaks: 0, color: '#2FA05A', desc: '60 yd speed · breaks none' }
    };
    const RPROPS = { density: 0.006, restitution: 0.45, frictionAir: 0.013 };

    const DEFSAVE = { unlocked: 1, stars: {}, yards: 0, power: 0, cleats: false,
                      bruiser: false, softHands: false, trackStar: false, filmStudy: false, spinMove: false, wrecker: false, chains: false };
    let SAVE;
    const persist = () => { try { localStorage.setItem('endzone_run_v1', JSON.stringify(SAVE)); } catch (e) {} };

    const W = 1024, H = 576, STEP = 1000 / 60;
    const FT = 96, FB = 488;
    const X0 = 130, PXYD = 33;
    const EZX = X0 + 100 * PXYD;
    const L = EZX + 150;
    let TEAMS = [], root = null, cv = null, cx = null, mainCx = null, buf = null, scan = null,
        engine = null, level = null, st = null,
        raf = null, active = false, lastT = 0, acc = 0, fx = null, clock = 0, cam = 0, camZoom = 1.0;
    const RES = 1.0;
    const V100 = {};

    const teamParts = (name) => {
        const m = name.match(/^(The Bog|London|Puddletown|New York|Washington|Manitoba|Lone Star|CT|Rhody|Mooloolaba|Wukanda|Driftwood|The Catalina Wine|Bikini Bottom|Mar a Lago|New England|Point Pleasant|Lake Champlain|Southie)\s+(.*)$/i);
        if (m) return { location: m[1], mascot: m[2] };
        const pts = name.split(' ');
        return { mascot: pts.pop() || '', location: pts.join(' ') || '' };
    };
    // (kept as fallbacks but PNG sprites are primary)
    function drawRunnerFB(x, y, w, h, color, flip, step, ghost) {
        cx.save(); cx.translate(x, y);
        if (flip) cx.scale(-1, 1);
        const s = w / 76;
        const legKick = step ? 6 : -6;
        cx.fillStyle = '#1a1a2e';
        cx.fillRect(-5*s, 14*s + legKick, 8*s, 18*s);
        cx.fillRect(3*s, 14*s - legKick, 8*s, 18*s);
        cx.fillStyle = '#111';
        cx.fillRect(-6*s, 30*s + legKick, 10*s, 5*s);
        cx.fillRect(2*s, 30*s - legKick, 10*s, 5*s);
        cx.fillStyle = color;
        cx.beginPath(); cx.roundRect(-14*s, -10*s, 28*s, 28*s, 6*s); cx.fill();
        cx.fillStyle = '#fff'; cx.font = `bold ${12*s}px Archivo`; cx.textAlign = 'center';
        cx.fillText('#1', 0, 8*s);
        cx.fillStyle = '#fff';
        cx.fillRect(-16*s, -8*s, 6*s, 12*s);
        cx.fillRect(10*s, -8*s, 6*s, 12*s);
        cx.fillStyle = color;
        cx.save(); cx.translate(-16*s, -2*s); cx.rotate(step ? -0.4 : 0.4);
        cx.fillRect(-3*s, 0, 6*s, 16*s); cx.restore();
        cx.save(); cx.translate(16*s, -2*s); cx.rotate(step ? 0.4 : -0.4);
        cx.fillRect(-3*s, 0, 6*s, 16*s); cx.restore();
        cx.fillStyle = '#8B4513';
        cx.save(); cx.translate(step ? 19*s : -19*s, 10*s);
        cx.beginPath(); cx.ellipse(0, 0, 7*s, 4*s, step ? 0.3 : -0.3, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#fff'; cx.lineWidth = 1*s;
        cx.beginPath(); cx.moveTo(-3*s, 0); cx.lineTo(3*s, 0); cx.stroke();
        cx.restore();
        cx.fillStyle = color;
        cx.beginPath(); cx.arc(0, -18*s, 14*s, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#ccc'; cx.lineWidth = 2.5*s;
        cx.beginPath(); cx.arc(10*s, -18*s, 8*s, -0.8, 0.8); cx.stroke();
        cx.beginPath(); cx.moveTo(8*s, -22*s); cx.lineTo(14*s, -18*s); cx.lineTo(8*s, -14*s); cx.stroke();
        cx.strokeStyle = '#fff'; cx.lineWidth = 2*s;
        cx.beginPath(); cx.arc(0, -18*s, 14*s, -1.8, -1.3); cx.stroke();
        cx.fillStyle = 'rgba(100,200,255,0.4)';
        cx.beginPath(); cx.arc(8*s, -18*s, 6*s, -0.6, 0.6); cx.fill();
        cx.strokeStyle = '#000'; cx.lineWidth = 2*s;
        cx.beginPath(); cx.arc(0, -18*s, 14*s, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.roundRect(-14*s, -10*s, 28*s, 28*s, 6*s); cx.stroke();
        cx.restore();
    }

    const IMG = {};
    ['run_rb', 'run_wr', 'run_te', 'def_stand', 'def_elite', 'def_ko', 'sled', 'teddy', 'teddy_ko', 'ref', 'cheer', 'dummy'].forEach(k => {
        const im = new Image(); im.src = 'assets/' + k + '.png'; IMG[k] = im;
        const ANIMATED = ['run_rb', 'run_wr', 'run_te', 'def_stand', 'def_elite', 'teddy', 'ref', 'cheer'];
        im.onload = () => { if (ANIMATED.includes(k) && im.naturalWidth > im.naturalHeight * 1.55) im.frames = 2; };
    });
    ['cones', 'cooler', 'tire'].forEach(k => {
        const im = new Image(); im.src = 'assets/' + k + '.png'; IMG[k] = im;
    });
    // per-team mascot defenders (2-frame strips where available)
    const MASCOT2F = ['bear', 'champ', 'moth', 'mech', 'bug', 'bird', 'winemixer', 'bronco',
                      'dolphin', 'lovetank', 'quahog', 'coolcat', 'ghost', 'moose'];
    const MASCOT1F = ['warhawk', 'redhulk', 'panther', 'swamp', 'nanny'];
    [...MASCOT2F, ...MASCOT1F].forEach(k => {
        const im = new Image(); im.src = 'assets/m_' + k + '.png';
        if (MASCOT2F.includes(k)) im.frames = 2;
        IMG['m_' + k] = im;
    });
    ['bear', 'champ', 'moth', 'mech', 'bug', 'bird', 'bronco', 'quahog',
     'coolcat', 'redhulk', 'nanny', 'swamp'].forEach(k => {
        const im = new Image(); im.src = 'assets/mko_' + k + '.png'; IMG['mko_' + k] = im;
    });
    const TEAM_MASCOT = {
        '368921092460462080': 'bear',     '310953370741407744': 'champ',
        '846183516587806720': 'moth',     '399425495596290048': 'mech',
        '996516356587753472': 'bug',      '867150076190052352': 'bird',
        '815024153592745984': 'nanny',    '337735453614567424': 'bronco',
        '578735109004378112': 'winemixer',
        '996510865815953408': 'dolphin',  '607155371257163776': 'lovetank',
        '818613649684946944': 'quahog',   '547635526044360704': 'coolcat',
        '893945727754317824': 'ghost',    '859484510746681344': 'moose',
        '867232149391265792': 'warhawk',  '1078334787837829120': 'redhulk',
        '721895832546390016': 'panther',  '868646780299010048': 'swamp'
    };
    const levelMascot = () => level != null && TEAMS[level] ? TEAM_MASCOT[TEAMS[level].ownerId] : null;
    (() => {})();

    function drawDummy(x, y, wobble) {
        cx.save(); cx.translate(x, y); cx.rotate(wobble * 0.02);
        // base
        cx.fillStyle = '#666';
        cx.fillRect(-6, 8, 12, 10);
        // body
        cx.fillStyle = '#c22f36';
        cx.beginPath(); cx.roundRect(-12, -16, 24, 28, 8); cx.fill();
        // target rings
        cx.strokeStyle = '#fff'; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(0, -2, 10, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(0, -2, 5, 0, Math.PI * 2); cx.stroke();
        // outline
        cx.strokeStyle = '#000'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.roundRect(-12, -16, 24, 28, 8); cx.stroke();
        cx.restore();
    }
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    const initials = name => name.replace(/^The /i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const hue = name => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
    const N = () => TEAMS.length;
    const difficulty = i => i / Math.max(N() - 1, 1);
    const isLocked = i => TEAMS[i].ownerId === SUMMIT_LOCK;
    const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const ydAt = x => Math.max(0, Math.min(100, (x - X0) / PXYD));
    const spotName = x => { const y = Math.round(ydAt(x)); return y < 50 ? 'OWN ' + y : y === 50 ? 'MIDFIELD' : 'OPP ' + (100 - y); };

    // ── meter calibration: how fast must a runner start to slide exactly N yards? ──
    function simDist(v) {
        const tmp = Engine.create(); tmp.gravity.y = 0;
        const b = Bodies.circle(0, 0, 16, RPROPS);
        Body.setVelocity(b, { x: v, y: 0 });
        World.add(tmp.world, b);
        for (let i = 0; i < 900; i++) {
            Engine.update(tmp, STEP);
            if (Vector.magnitude(b.velocity) < 0.5) break;
        }
        return b.position.x;
    }
    const effMaxYd = k => RUNNERS[k].maxYd + (k === 'wr' && SAVE.trackStar ? 10 : 0);
    const effBreaks = k => {
        const r = RUNNERS[k];
        return r.breaks + (k === 'rb' && SAVE.bruiser ? 1 : 0) + (k === 'te' && SAVE.softHands ? 1 : 0);
    };
    function calibrate() {
        const d10 = simDist(10); // distance is ~linear in launch speed under air drag
        Object.keys(RUNNERS).forEach(k => { V100[k] = 10 * (effMaxYd(k) * PXYD) / d10; });
    }

    // ── fx ──────────────────────────────────────────────────────────────────
    function shards(x, y, color, n, speed) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random()) * speed;
            fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                            life: 26 + Math.random() * 20, color, sz: 2 + Math.random() * 4, rot: Math.random() * 6 });
        }
    }
    function puff(x, y, n) {
        for (let i = 0; i < n; i++)
            fx.parts.push({ x: x + (Math.random()-0.5)*16, y: y + (Math.random()-0.5)*14,
                            vx: (Math.random()-0.5)*1.2, vy: (Math.random()-0.5)*1.2,
                            life: 20 + Math.random()*14, color: 'rgba(230,255,220,0.8)', sz: 5 + Math.random()*7, cloud: true });
    }
    function popText(x, y, txt, color) { fx.texts.push({ x, y, txt, color, life: 75, maxLife: 75 }); }
    function shake(m) { fx.shake = Math.max(fx.shake, m); }

    // ── level ───────────────────────────────────────────────────────────────
    function buildLevel(idx) {
        level = idx; clock = 0;
        const d = difficulty(idx), rng = mulberry(idx * 977 + 31), lockd = isLocked(idx);
        const defs = [], sleds = [];
        const nDef = 8 + Math.round(d * 11);
        const startX = X0 + 20 * PXYD;
        for (let i = 0; i < nDef; i++) {
            const fr = (i + 0.5) / nDef;
            defs.push({ x: startX + 220 + (fr + (rng() - 0.5) * 0.06) * (EZX - startX - 310),
                        y: FT + 34 + rng() * (FB - FT - 68), ko: false, elite: false, koX: 0, koY: 0 });
        }
        const nSled = 1 + Math.round(d * 3);
        for (let i = 0; i < nSled; i++)
            sleds.push({ x: startX + 300 + ((i + 0.5) / nSled + (rng() - 0.5) * 0.08) * (EZX - startX - 400),
                         y: FT + 50 + rng() * (FB - FT - 100) });
        const bumpers = [], walls = [], cones = [], coolers = [], tires = [];
        const nCone = 1 + Math.round(d * 2);
        for (let i = 0; i < nCone; i++)
            cones.push({ x: startX + 250 + ((i + 0.5) / nCone + (rng() - 0.5) * 0.14) * (EZX - startX - 350),
                         y: FT + 40 + rng() * (FB - FT - 80), hit: false });
        if (d > 0.2) coolers.push({ x: startX + 320 + rng() * (EZX - startX - 460), y: rng() > 0.5 ? FT + 42 : FB - 42 });
        const nTire = d > 0.45 ? 2 : 1;
        for (let i = 0; i < nTire; i++)
            tires.push({ x: startX + 280 + ((i + 0.5) / nTire + (rng() - 0.5) * 0.12) * (EZX - startX - 380),
                         y: FT + 46 + rng() * (FB - FT - 92) });
        const nBump = 1 + Math.round(d * 2);
        for (let i = 0; i < nBump; i++)
            bumpers.push({ x: startX + 260 + ((i + 0.5) / nBump + (rng() - 0.5) * 0.1) * (EZX - startX - 360),
                           y: FT + 44 + rng() * (FB - FT - 88) });
        const nWall = Math.round(d * 2.4);
        for (let i = 0; i < nWall; i++)
            walls.push({ x: startX + 340 + ((i + 0.5) / Math.max(nWall, 1) + (rng() - 0.5) * 0.1) * (EZX - startX - 440),
                         y: FT + 80 + rng() * (FB - FT - 160) });
        const refs = [], cheers = [];
        const nRef = (d >= 0.15 ? 1 : 0) + (d >= 0.65 ? 1 : 0);
        for (let i = 0; i < nRef; i++)
            refs.push({ x: startX + 380 + ((i + 0.5) / Math.max(nRef, 1) + (rng() - 0.5) * 0.12) * (EZX - startX - 500),
                        base: (FT + FB) / 2, amp: 90 + rng() * 60, spd: 0.018 + rng() * 0.012, ph: rng() * 6.28 });
        const nCheer = d >= 0.35 ? 2 : 1;
        for (let i = 0; i < nCheer; i++)
            cheers.push({ x: startX + 300 + rng() * (EZX - startX - 420),
                          y: i % 2 === 0 ? FT + 36 : FB - 36 });

        st = { defs, sleds, bumpers, walls, cones, coolers, tires, refs, cheers, lockd, down: 1, maxDowns: lockd ? 10 : 4,
               scrimmage: startX, phase: 'angle', runnerType: RUNNERS[st?.runnerType] ? st.runnerType : 'rb',
               angle: 0, pf: 0, breaks: 0, runner: null, bestX: startX, koCount: 0,
               settleT: 0, tauntT: 0, meterT: 0, focusX: startX };
        fx = { parts: [], texts: [], shake: 0, trail: [] };
        cam = Math.max(0, st.scrimmage - 340);
        startDown();
    }

    function startDown() {
        engine = Engine.create(); engine.gravity.y = 0;
        st.runner = null; st.phase = 'angle'; st.settleT = 0; st.meterT = 0; fx.trail = [];
        st.focusX = st.scrimmage;
        // safety bubble: nobody camps the launch spot
        const anchor = { x: st.scrimmage, y: (FT + FB) / 2 }, BUB = 260;
        // clear a straight-ahead launch lane so no spot is ever walled in
        const laneClear = o => {
            if (o.x > anchor.x + 20 && o.x < anchor.x + 380 && Math.abs(o.y - anchor.y) < 95) {
                o.y = anchor.y + (o.y >= anchor.y ? 1 : -1) * (120 + Math.random() * 50);
                o.y = Math.max(FT + 34, Math.min(FB - 34, o.y));
            }
        };
        [st.sleds, st.bumpers, st.walls, st.cones, st.coolers, st.tires].forEach(list => list.forEach(laneClear));
        const pushOut = o => {
            const dx = o.x - anchor.x, dy = o.y - anchor.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= BUB) return;
            const nx = dist > 1 ? dx / dist : 1, ny = dist > 1 ? dy / dist : 0;
            o.x = Math.min(anchor.x + nx * BUB + (nx > 0 ? 0 : BUB * 2), EZX - 60);
            o.y = Math.max(FT + 34, Math.min(FB - 34, anchor.y + ny * BUB));
        };
        st.defs.forEach(dd => { if (!dd.ko && !dd.elite) pushOut(dd); });
        st.sleds.forEach(pushOut); st.bumpers.forEach(pushOut); st.walls.forEach(pushOut); st.cheers.forEach(pushOut); st.refs.forEach(pushOut);
        st.cones.forEach(pushOut); st.coolers.forEach(pushOut); st.tires.forEach(pushOut);
        const bodies = [];
        st.sleds.forEach((s, i) => {
            if (s.hit) return;
            const b = Bodies.rectangle(s.x, s.y, 74, 26, { isStatic: true });
            b.gtype = 'sled'; b.si = i; bodies.push(b);
        });
        st.cones.forEach((s, i) => {
            if (s.hit) return;
            const b = Bodies.circle(s.x, s.y, 15, { isStatic: true });
            b.gtype = 'cones'; b.ci = i; bodies.push(b);
        });
        st.coolers.forEach(s => {
            const b = Bodies.rectangle(s.x, s.y, 56, 44, { isStatic: true, restitution: 0.8 });
            b.gtype = 'cooler'; bodies.push(b);
        });
        st.tires.forEach(s => {
            const b = Bodies.circle(s.x, s.y, 25, { isStatic: true, restitution: 1.05 });
            b.gtype = 'tire'; bodies.push(b);
        });
        st.bumpers.forEach(s => {
            const b = Bodies.circle(s.x, s.y, 22, { isStatic: true, restitution: 1 });
            b.gtype = 'bumper'; bodies.push(b);
        });
        st.walls.forEach((s, i) => {
            if (s.hit) return;
            const b = Bodies.rectangle(s.x, s.y, 20, 128, { isStatic: true, restitution: 0.9 });
            b.gtype = 'wall'; b.wi = i; bodies.push(b);
        });
        st.refs.forEach((s, i) => {
            const b = Bodies.circle(s.x, s.base, 17, { isStatic: true, restitution: 0.7 });
            b.gtype = 'ref'; b.ri = i; bodies.push(b);
        });
        st.cheers.forEach(s => {
            const b = Bodies.circle(s.x, s.y, 16, { isStatic: true, restitution: 0.8 });
            b.gtype = 'cheer'; bodies.push(b);
        });
        st.defs.forEach((dd, i) => {
            if (dd.ko) return;
            const b = Bodies.circle(dd.x, dd.y, 17,
                { density: dd.elite ? 0.09 : 0.006, frictionAir: 0.06, restitution: 0.1 });
            b.gtype = 'def'; b.di = i; b.elite = dd.elite;
            if (dd.elite) Body.setStatic(b, true);
            bodies.push(b);
        });
        World.add(engine.world, bodies);
        Events.on(engine, 'collisionStart', onHit);
        updateHUD(); drawPicker();
        setMsg(downLabel() + ' · ' + spotName(st.scrimmage) + ' — TAP to lock the arrow, TAP again for power!');
    }
    const downLabel = () => (st.down <= 5 ? ['1ST', '2ND', '3RD', '4TH', '5TH'][st.down - 1] : st.down + 'TH') + ' DOWN';

    // ── collisions / tackles ────────────────────────────────────────────────
    function koDef(body, label) {
        const dd = st.defs[body.di];
        if (!dd || dd.ko || dd.elite) return;
        dd.ko = true; dd.koX = body.position.x; dd.koY = body.position.y;
        st.koCount++;
        World.remove(engine.world, body);
        shards(dd.koX, dd.koY, '#FFD84D', 20, 6);
        puff(dd.koX, dd.koY, 15);
        popText(dd.koX, dd.koY - 26, label || 'KO!', '#FF6B57');
        shake(18);
    }
    function tackled(spotX, reason) {
        if (st.phase !== 'flight') return;
        st.phase = 'spot';
        const r = st.runner;
        if (r) { 
            puff(r.position.x, r.position.y, 25); 
            shards(r.position.x, r.position.y, '#fff', 15, 5); 
            World.remove(engine.world, r); 
            st.runner = null; 
        }
        shake(22);
        const adv = Math.max(spotX, st.scrimmage);
        st.focusX = adv;
        popText(adv, (FT + FB) / 2 - 60, (reason || 'TACKLED') + ' — ' + spotName(adv), '#fff');
        setTimeout(() => {
            if (!st) return;
            st.scrimmage = Math.min(Math.max(adv, X0 + 10), EZX - 40);
            if (SAVE.chains && !st.chainsUsed && ydAt(st.scrimmage) >= 50) {
                st.chainsUsed = true;
                st.down = 0;
                popText(st.scrimmage, (FT + FB) / 2 - 80, 'MOVED THE CHAINS — FRESH SET OF DOWNS!', '#34D399');
            }
            if (st.down >= st.maxDowns) return endLevel(false);
            st.down++;
            startDown();
        }, 900);
    }
    function onHit(ev) {
        if (!st) return;
        ev.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            const run = bodyA.gtype === 'runner' ? bodyA : bodyB.gtype === 'runner' ? bodyB : null;
            const oth = run === bodyA ? bodyB : bodyA;
            if (!run || st.phase !== 'flight') return;
            if (oth.gtype === 'def') {
                if (oth.elite) {
                    Body.setVelocity(run, { x: -Math.abs(run.velocity.x) * 0.6 - 4, y: run.velocity.y * 0.5 });
                    puff(run.position.x, run.position.y, 6); shake(8);
                    setMsg('BOUNCED OFF THE BEAR WALL!');
                } else if (run.ghost > 0) {
                    puff(run.position.x, run.position.y, 5);
                    Body.applyForce(oth, oth.position, { x: 0, y: (oth.position.y > run.position.y ? 1 : -1) * 0.05 * oth.mass });
                    const lv = run.lastV;
                    if (lv) setTimeout(() => { if (st && st.runner === run) Body.setVelocity(run, lv); }, 0);
                } else if (st.breaks > 0) {
                    st.breaks--;
                    koDef(oth, 'BROKEN TACKLE!');
                    Body.setVelocity(run, { x: run.velocity.x * 0.78, y: run.velocity.y * 0.78 });
                    updateHUD();
                } else {
                    tackled(run.position.x);
                }
            } else if (oth.gtype === 'sled') {
                const rel = Vector.magnitude(Vector.sub(bodyA.velocity, bodyB.velocity));
                if (SAVE.wrecker && rel > 4) {
                    st.sleds[oth.si].hit = true;
                    World.remove(engine.world, oth);
                    shards(oth.position.x, oth.position.y, '#c22f36', 12, 4);
                    shards(oth.position.x, oth.position.y, '#a8b0bc', 6, 3);
                    popText(oth.position.x, oth.position.y - 28, 'SLED DEMOLISHED!', '#FFB03C');
                    shake(6);
                    Body.setVelocity(run, { x: run.velocity.x * 0.9, y: run.velocity.y * 0.9 });
                    return;
                }
                puff(run.position.x, run.position.y, 4); shake(3);
                if (rel < 3.5) tackled(run.position.x, 'PILED INTO THE SLED');
            } else if (oth.gtype === 'bumper') {
                oth.hitT = 12;
                shards(run.position.x, run.position.y, '#7FD4FF', 6, 2.5); shake(4);
                popText(run.position.x, run.position.y - 30, 'RICOCHET!', '#7FD4FF');
                setTimeout(() => { if (st && st.runner === run) Body.setVelocity(run, Vector.mult(run.velocity, 1.22)); }, 0);
            } else if (oth.gtype === 'cones') {
                st.cones[oth.ci].hit = true;
                World.remove(engine.world, oth);
                shards(oth.position.x, oth.position.y, '#f5901e', 9, 4);
                shards(oth.position.x, oth.position.y, '#e8d23a', 5, 3.5);
                popText(oth.position.x, oth.position.y - 26, 'CONES EVERYWHERE!', '#FFB03C');
                shake(3);
                Body.setVelocity(run, { x: run.velocity.x * 0.96, y: run.velocity.y * 0.96 });
            } else if (oth.gtype === 'cooler') {
                oth.hitT = 12;
                shards(run.position.x, run.position.y, '#59b8f0', 12, 3.5); shake(4);
                popText(oth.position.x, oth.position.y - 32, 'GATORADE BATH!', '#7FD4FF');
            } else if (oth.gtype === 'tire') {
                oth.hitT = 12;
                puff(run.position.x, run.position.y, 4); shake(3);
                popText(oth.position.x, oth.position.y - 30, 'OFF THE TIRE!', '#fff');
            } else if (oth.gtype === 'wall' && SAVE.wrecker && Vector.magnitude(Vector.sub(bodyA.velocity, bodyB.velocity)) > 4.5) {
                st.walls[oth.wi].hit = true;
                World.remove(engine.world, oth);
                shards(oth.position.x, oth.position.y, '#e8762c', 14, 4);
                popText(oth.position.x, oth.position.y - 34, 'BARRIER DOWN!', '#FFB03C');
                shake(6);
                Body.setVelocity(run, { x: run.velocity.x * 0.88, y: run.velocity.y * 0.88 });
            } else if (oth.gtype === 'wall') {
                oth.hitT = 12;
                puff(run.position.x, run.position.y, 5); shake(3);
                popText(run.position.x, run.position.y - 30, 'BOUNCE!', '#fff');
            } else if (oth.gtype === 'ref') {
                puff(run.position.x, run.position.y, 5); shake(4);
                popText(oth.position.x, oth.position.y - 34, 'TWEET! PLAY ON!', '#FFE58A');
            } else if (oth.gtype === 'cheer') {
                shards(oth.position.x, oth.position.y - 10, '#E23C50', 10, 3);
                shards(oth.position.x, oth.position.y - 10, '#fff', 6, 2.5); shake(4);
                popText(oth.position.x, oth.position.y - 34, 'POM-POM PANIC!', '#FF9CB0');
            }
        });
    }

    // ── meter fire ──────────────────────────────────────────────────────────
    const sweepAngle = () => Math.sin(st.meterT * 0.042) * (Math.PI * 0.30);
    const sweepPower = () => (Math.sin(st.meterT * 0.062 - Math.PI / 2) + 1) / 2;
    function fire() {
        const type = st.runnerType, r = RUNNERS[type];
        const base = r.baseType || type;
        const speed = V100[base] * Math.max(st.pf, 0.15) * (1 + SAVE.power * 0.15) * (SAVE.cleats ? 1.08 : 1);
        const body = Bodies.circle(st.scrimmage, (FT + FB) / 2, 16, RPROPS);
        body.gtype = 'runner'; body.rtype = base; body.rcolor = r.color;
        Body.setVelocity(body, { x: Math.cos(st.angle) * speed, y: Math.sin(st.angle) * speed });
        World.add(engine.world, body);
        st.runner = body; st.breaks = effBreaks(type); st.spinUsed = false; st.phase = 'flight'; st.settleT = 0;
        if (st.pf > 0.94) popText(st.scrimmage + 60, (FT + FB) / 2 - 50, 'PERFECT!', '#FFE58A');
        updateHUD(); drawPicker();
    }

    // ── per-step logic ──────────────────────────────────────────────────────
    function tickTurn(dtms) {
        if (!st) return;
        if (st.phase === 'angle' || st.phase === 'power') { st.meterT++; return; }
        if (st.phase !== 'flight') return;
        const r = st.runner;
        if (!r) return;
        if (r.ghost > 0) r.ghost--;
        r.lastV = { x: r.velocity.x, y: r.velocity.y };
        fx.trail.push({ x: r.position.x, y: r.position.y, life: 15 });
        if (fx.trail.length > 30) fx.trail.shift();
        st.bestX = Math.max(st.bestX, r.position.x);
        const d = difficulty(level);
        Composite.allBodies(engine.world).forEach(b => {
            if (b.gtype === 'ref') {
                const rf = st.refs[b.ri];
                Body.setPosition(b, { x: rf.x, y: Math.max(FT + 26, Math.min(FB - 26,
                    rf.base + Math.sin(clock * rf.spd + rf.ph) * rf.amp)) });
                return;
            }
            if (b.gtype !== 'def' || b.elite) return;
            const dv = Vector.sub(r.position, b.position), dist = Vector.magnitude(dv);
            if (dist < 380 && dist > 1)
                Body.applyForce(b, b.position, Vector.mult(Vector.normalise(dv), 0.0014 * b.mass * (0.7 + d)));
        });
        if (r.position.y < FT + 12 || r.position.y > FB - 12) return tackled(r.position.x, 'OUT OF BOUNDS');
        if (r.position.x > EZX + 6) {
            if (st.lockd) {
                shards(r.position.x, r.position.y, '#f5d312', 16, 4);
                popText(r.position.x - 60, r.position.y - 50, 'FLAG ON THE PLAY!', '#f5d312');
                return tackled(EZX - 60, 'HOLDING — TD CALLED BACK');
            }
            st.phase = 'over-pending';
            shards(r.position.x, r.position.y, '#FFE58A', 30, 5); shake(10);
            popText(r.position.x, r.position.y - 40, 'TOUCHDOWN!', '#FFE58A');
            return endLevel(true);
        }
        if (st.lockd && r.position.x > EZX - 90 && st.tauntT <= 0) {
            st.tauntT = 180;
            setMsg(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
        }
        if (st.tauntT > 0) st.tauntT--;
        const slow = Vector.magnitude(r.velocity) < 0.55;
        st.settleT = slow ? st.settleT + dtms : 0;
        if (st.settleT > 700) tackled(r.position.x, 'BROUGHT DOWN');
    }

    function endLevel(win) {
        if (!st || st.phase === 'over') return;
        st.phase = 'over';
        const team = TEAMS[level];
        if (win && !st.lockd) {
            const stars = st.down <= 2 ? 3 : st.down === 3 ? 2 : 1;
            const ydGain = 80 + level * 25 + stars * 30 + st.koCount * 10;
            SAVE.stars[level] = Math.max(SAVE.stars[level] || 0, stars);
            SAVE.yards += ydGain;
            SAVE.unlocked = Math.max(SAVE.unlocked, level + 2);
            persist();
            overlayHTML(`<h2 class="display" style="color:#E8C547;font-size:24px;text-transform:uppercase;text-shadow:0 2px 8px rgba(232,197,71,0.4)">Touchdown — W!</h2>
                <p class="ag-sub" style="margin-bottom:8px">You beat ${esc(team.team)} on ${downLabel().toLowerCase()}</p>
                <p style="font-size:28px;color:#E8C547;text-shadow:0 0 12px rgba(232,197,71,0.4)">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
                <p style="font-size:14px;margin:12px 0;color:#34D399;font-weight:600">+ ${ydGain} yds · ${st.koCount} defenders KO’d</p>
                <div class="ag-btns">
                ${level + 1 < N() ? `<button class="pill" onclick="ARCADE.start(${level + 1})">Next: ${esc(TEAMS[level + 1].team)}</button>`
                                  : '<span class="display" style="color:#E8C547;font-size:18px">YOU RULE THE SUMMIT</span>'}
                <button class="pill" onclick="ARCADE.lockerRoom()">Locker Room</button><button class="pill" onclick="ARCADE.ladder()">Map</button></div>`);
        } else {
            const bestYd = Math.round(ydAt(st.bestX));
            const consolation = Math.round(bestYd / 4) + st.koCount * 5;
            SAVE.yards += consolation; persist();
            if (st.lockd) {
                overlayHTML(`<div style="text-align:center">
                    <div style="display:inline-block;background:linear-gradient(160deg,#06301C,#0B5230);border-left:8px solid #E8C547;
                         border-radius:12px;padding:14px 26px;margin-bottom:14px;box-shadow:0 10px 26px rgba(0,0,0,0.55)">
                        <p class="display" style="color:#E8C547;font-size:13px;letter-spacing:0.2em;margin:0">🏆 2025 GREEN JACKET CHAMPIONS 🏆</p>
                    </div>
                    <div><img src="https://sleepercdn.com/uploads/a9112a446c261f19b83fbbedf03fb2f3.jpg"
                         style="width:130px;height:130px;border-radius:16px;border:3px solid #E8C547;object-fit:cover;
                                box-shadow:0 0 30px rgba(232,197,71,0.35)"></div>
                    <h2 class="display" style="color:#E8C547;font-size:22px;text-transform:uppercase;margin:12px 0 6px">Nobody Beats the<br>Southie Thunder Buddies</h2>
                    <p class="ag-sub" style="text-align:center;max-width:380px;margin:0 auto 6px">Ten downs of your absolute best shot… and you just got
                       stuffed by a pile of teddy bears. Let that sink in. The scoreboard forgets — the banner doesn't.</p>
                    <p class="ag-sub" style="text-align:center;color:#E8C547">GOOD LUCK NEXT SEASON. YOU'LL NEED IT.</p>
                    <p style="font-size:12px;color:#34D399;margin:6px 0">+ ${consolation} effort yards for the attempt</p>
                    <div class="ag-btns" style="justify-content:center">
                        <button class="pill" onclick="ARCADE.start(${level})">Try again (lol)</button>
                        <button class="pill" onclick="ARCADE.ladder()">Back to the ladder</button>
                    </div></div>`);
                return;
            }
            const taunt = st.lockd ? TAUNTS[Math.floor(Math.random() * TAUNTS.length)]
                                   : `${esc(team.team)}’s defense holds — drive died at the ${spotName(st.bestX)}.`;
            overlayHTML(`<h2 class="display" style="color:#EF4444;font-size:24px;text-transform:uppercase;text-shadow:0 2px 8px rgba(239,68,68,0.4)">Turnover on Downs</h2>
                <p class="ag-sub" style="margin-bottom:8px">${taunt}</p>
                <p style="font-size:13px;color:#34D399;margin-bottom:8px;font-weight:600">+ ${consolation} effort yards</p>
                <div class="ag-btns"><button class="pill" onclick="ARCADE.start(${level})">Retry drive</button>
                <button class="pill" onclick="ARCADE.lockerRoom()">Locker Room</button><button class="pill" onclick="ARCADE.ladder()">Map</button></div>`);
        }
    }

    // ── input: tap-tap meter ────────────────────────────────────────────────
    const onDown = e => {
        if (!st) return;
        if (st.phase === 'angle') { e.preventDefault(); st.angle = sweepAngle(); st.phase = 'power'; st.meterT = 0; updateHUD(); }
        else if (st.phase === 'power') { e.preventDefault(); st.pf = sweepPower(); fire(); }
        else if (st.phase === 'flight' && SAVE.spinMove && !st.spinUsed && st.runner) {
            e.preventDefault();
            st.spinUsed = true;
            st.runner.ghost = 55;
            popText(st.runner.position.x, st.runner.position.y - 32, 'SPIN MOVE!', '#D8A6FF');
            updateHUD();
        }
    };
    const onKey = e => {
        if (e.code === 'Space' && st && (st.phase === 'angle' || st.phase === 'power')) { e.preventDefault(); onDown(e); }
    };

    // ── render ──────────────────────────────────────────────────────────────
    function drawSprite(img, x, y, w, h, angle, animateFlag) {
        if (!img || !img.complete || !img.naturalWidth) return false;
        cx.save(); cx.translate(x, y); if (angle) cx.rotate(angle);
        cx.imageSmoothingEnabled = false;
        
        const fit = (fw, fh) => {
            const s = Math.min(w / fw, h / fh);
            return [fw * s, fh * s];
        };
        if (img.frames > 1) {
            const frames = img.frames || Math.max(2, Math.round(img.naturalWidth / img.naturalHeight));
            const frameW = img.naturalWidth / frames;
            const frameIndex = animateFlag === 2 ? frames - 1 : animateFlag ? Math.floor(clock / 6) % frames : 0;
            const [dw, dh] = fit(frameW, img.naturalHeight);
            cx.drawImage(img, frameIndex * frameW, 0, frameW, img.naturalHeight, -dw/2, -dh/2, dw, dh);
        } else {
            const stepToggle = (Math.floor(clock / 7) % 2) === 0;
            if (animateFlag && stepToggle) cx.scale(-1, 1);
            const [dw, dh] = fit(img.naturalWidth, img.naturalHeight);
            cx.drawImage(img, -dw/2, -dh/2, dw, dh);
        }
        
        cx.restore();
        return true;
    }
    function shadow(x, y, rx) {
        cx.fillStyle = 'rgba(0,50,0,0.34)';
        cx.beginPath(); cx.ellipse(x, y, rx, rx * 0.4, 0, 0, Math.PI * 2); cx.fill();
    }
    function draw() {
        if (level == null || !st) return;
        cx.setTransform(RES, 0, 0, RES, 0, 0);
        cx.save();
        if (camZoom !== 1.0) {
            cx.translate(W/2, H/2);
            cx.scale(camZoom, camZoom);
            cx.translate(-W/2, -H/2);
        }
        if (fx && fx.shake > 0.3) { cx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake); fx.shake *= 0.85; }
        cx.fillStyle = '#1a2230'; cx.fillRect(0, 0, W, H);
        const tCol = level != null ? TEAMS[level].color : '#2FA05A';
        for (const [cy, ch, flipBand] of [[0, FT - 42, 0], [FB + 42, H - FB - 42, 1]]) {
            // upper deck (darker) and lower deck split by a rail
            const split = cy + ch * 0.48;
            cx.fillStyle = '#242f42'; cx.fillRect(0, cy, W, split - cy);
            cx.fillStyle = '#31405a'; cx.fillRect(0, split, W, cy + ch - split);
            // seat sections tinted alternating home hue / neutral
            for (let sx = -((Math.floor(cam / 6) * 6) % 240); sx < W; sx += 120) {
                if (((sx + Math.floor(cam / 6) * 6) / 120 | 0) % 2 === 0) {
                    cx.fillStyle = tCol;
                    cx.globalAlpha = 0.35;
                    cx.fillRect(sx, cy, 120, ch);
                    cx.globalAlpha = 1;
                }
            }
            // crowd heads, two decks, gentle wave
            for (let x = 0; x < W; x += 6) {
                const gx = x + Math.floor(cam / 6) * 6;
                const seed = Math.abs(Math.sin((gx + cy) * 12.9898) * 43758.5453) % 1;
                const wave = Math.sin(clock * 0.05 + gx * 0.02) * 1.5;
                const tw = ((clock >> 3) + gx) % 53 === 0;
                cx.fillStyle = tw ? '#fff' : `hsl(${Math.floor(seed * 360)},40%,${52 + (x % 3) * 8}%)`;
                cx.fillRect(x + 1, cy + 3 + seed * (split - cy - 8) + wave, 4, 4);
                const seed2 = Math.abs(Math.sin((gx + cy) * 7.31) * 91733.2) % 1;
                cx.fillStyle = `hsl(${Math.floor(seed2 * 360)},38%,${46 + (x % 4) * 7}%)`;
                cx.fillRect(x + 2, split + 4 + seed2 * (cy + ch - split - 10), 4, 4);
            }
            cx.fillStyle = '#0d1420'; cx.fillRect(0, split - 2, W, 3);
            cx.fillStyle = '#3f5273'; cx.fillRect(0, cy + ch - 3, W, 3);
        }
        if (!st) { cx.restore(); return; }

        cx.save(); cx.translate(-cam, 0);
        cx.fillStyle = '#446a32';
        cx.fillRect(cam - 20, FT - 42, W + 40, 42); cx.fillRect(cam - 20, FB, W + 40, 42);
        // coach's box dashed lines
        cx.strokeStyle = 'rgba(255,255,255,0.35)'; cx.lineWidth = 2; cx.setLineDash([10, 10]);
        cx.beginPath(); cx.moveTo(cam - 20, FT - 14); cx.lineTo(cam + W + 20, FT - 14); cx.stroke();
        cx.beginPath(); cx.moveTo(cam - 20, FB + 14); cx.lineTo(cam + W + 20, FB + 14); cx.stroke();
        cx.setLineDash([]);
        // benches with sitting squads + gatorade coolers
        for (let bx = 400; bx < L; bx += 900) {
            if (bx + 240 < cam || bx > cam + W) continue;
            cx.fillStyle = '#7a5a34'; cx.fillRect(bx, FB + 20, 220, 8);
            cx.fillStyle = '#5e4426'; cx.fillRect(bx, FB + 28, 220, 4);
            for (let i = 0; i < 7; i++) {
                cx.fillStyle = tCol; cx.globalAlpha = 0.8; cx.fillRect(bx + 12 + i * 30, FB + 10, 10, 12); cx.globalAlpha = 1;
                cx.fillStyle = '#e8c896'; cx.fillRect(bx + 14 + i * 30, FB + 6, 6, 6);
            }
            cx.fillStyle = '#e8762c'; cx.fillRect(bx + 232, FB + 12, 12, 16);
            cx.fillStyle = '#fff'; cx.fillRect(bx + 234, FB + 10, 8, 3);
        }
        cx.strokeStyle = '#fff'; cx.lineWidth = 5;
        cx.beginPath(); cx.moveTo(cam - 20, FT); cx.lineTo(cam + W + 20, FT); cx.stroke();
        cx.beginPath(); cx.moveTo(cam - 20, FB); cx.lineTo(cam + W + 20, FB); cx.stroke();
        for (let ydn = -10; ydn < 110; ydn += 5) {
            const x = X0 + ydn * PXYD;
            if (x + 5 * PXYD < cam - 20 || x > cam + W + 20) continue;
            cx.fillStyle = (ydn / 5) % 2 === 0 ? '#3d7c28' : '#468a2f';
            cx.fillRect(x, FT, 5 * PXYD, FB - FT);
        }
        // cleaner grass for cartoon style
        for (let ydn = 0; ydn <= 100; ydn += 5) {
            const x = X0 + ydn * PXYD;
            if (x < cam - 30 || x > cam + W + 30) continue;
            cx.strokeStyle = 'rgba(255,255,255,0.85)'; cx.lineWidth = ydn % 10 === 0 ? 3 : 2;
            cx.beginPath(); cx.moveTo(x, FT); cx.lineTo(x, FB); cx.stroke();
            if (ydn % 10 === 0 && ydn > 0 && ydn < 100) {
                const disp = ydn <= 50 ? ydn : 100 - ydn;
                cx.font = 'bold 18px Archivo'; cx.textAlign = 'center';
                cx.fillStyle = 'rgba(0,40,0,0.45)';
                cx.fillText(String(disp), x + 2, FT + 36); cx.fillText(String(disp), x + 2, FB - 18);
                cx.fillStyle = 'rgba(255,255,255,0.88)';
                cx.fillText(String(disp), x, FT + 34); cx.fillText(String(disp), x, FB - 20);
                cx.textAlign = 'left';
            }
        }
        cx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let ydn = 0; ydn < 100; ydn++) {
            const x = X0 + ydn * PXYD;
            if (x < cam - 20 || x > cam + W + 20) continue;
            cx.fillRect(x - 1, (FT + FB) / 2 - 46, 3, 7); cx.fillRect(x - 1, (FT + FB) / 2 + 39, 3, 7);
        }
        const midX = X0 + 50 * PXYD;
        if (midX > cam - 90 && midX < cam + W + 90) {
            cx.fillStyle = 'rgba(232,197,71,0.85)';
            cx.beginPath(); cx.arc(midX, (FT + FB) / 2, 44, 0, Math.PI * 2); cx.fill();
            cx.strokeStyle = 'rgba(11,14,20,0.6)'; cx.lineWidth = 3; cx.stroke();
            cx.fillStyle = '#0B0E14'; cx.font = 'italic 900 26px Archivo'; cx.textAlign = 'center';
            cx.fillText('ITC', midX, (FT + FB) / 2 + 9); cx.textAlign = 'left';
        }
        cx.fillStyle = 'rgba(232,197,71,0.8)'; cx.fillRect(X0 - 110, FT, 110, FB - FT);
        cx.save(); cx.translate(X0 - 55, (FT + FB) / 2); cx.rotate(-Math.PI / 2);
        cx.fillStyle = '#0B0E14'; cx.font = 'italic 900 30px Archivo'; cx.textAlign = 'center';
        cx.fillText('THE CLIMB', 0, 10); cx.restore();
        const tCol2 = level != null ? TEAMS[level].color2 : '#1a2230';
        cx.fillStyle = tCol; cx.fillRect(EZX, FT, 130, FB - FT);
        cx.save(); cx.beginPath(); cx.rect(EZX, FT, 130, FB - FT); cx.clip();
        cx.strokeStyle = 'rgba(255,255,255,0.14)'; cx.lineWidth = 9;
        for (let y = FT - 40; y < FB + 40; y += 30) { cx.beginPath(); cx.moveTo(EZX - 10, y); cx.lineTo(EZX + 140, y + 50); cx.stroke(); }
        cx.restore();
        cx.save(); cx.translate(EZX + 68, (FT + FB) / 2); cx.rotate(Math.PI / 2);
        cx.fillStyle = 'rgba(255,255,255,0.92)'; cx.font = 'italic 900 18px Archivo'; cx.textAlign = 'center';
        const tp = teamParts(TEAMS[level].team);
        cx.fillText(tp.mascot.toUpperCase(), 0, 0);
        cx.font = 'italic 700 12px Archivo';
        cx.fillText(tp.location.toUpperCase(), 0, 18);
        cx.restore();
        for (let yy = FT; yy < FB; yy += 16) {
            cx.fillStyle = (yy / 16 | 0) % 2 === 0 ? '#fff' : tCol2;
            cx.fillRect(EZX + 122, yy, 8, 16);
        }
        cx.strokeStyle = '#fff'; cx.lineWidth = 4;
        cx.beginPath(); cx.moveTo(EZX, FT); cx.lineTo(EZX, FB); cx.stroke();
        cx.fillStyle = '#ff7b1c';
        [[EZX, FT - 6], [EZX, FB - 2], [X0, FT - 6], [X0, FB - 2]].forEach(([px, py]) => cx.fillRect(px - 4, py, 8, 8));
        // scrimmage line + best progress + down marker
        cx.strokeStyle = 'rgba(46,134,208,0.85)'; cx.lineWidth = 3;
        cx.beginPath(); cx.moveTo(st.scrimmage, FT); cx.lineTo(st.scrimmage, FB); cx.stroke();
        if (st.bestX > st.scrimmage + 4) {
            cx.strokeStyle = 'rgba(232,197,71,0.55)';
            cx.beginPath(); cx.moveTo(st.bestX, FT); cx.lineTo(st.bestX, FB); cx.stroke();
        }
        cx.fillStyle = '#ff7b1c'; cx.fillRect(st.scrimmage - 3, FT - 34, 6, 30);
        cx.fillStyle = '#0B0E14';
        cx.beginPath(); cx.arc(st.scrimmage, FT - 34, 12, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#ff7b1c'; cx.lineWidth = 2.5; cx.stroke();
        cx.fillStyle = '#fff'; cx.font = 'bold 13px Archivo'; cx.textAlign = 'center';
        cx.fillText(String(st.down), st.scrimmage, FT - 29); cx.textAlign = 'left';

        // film study: pursuit ranges revealed during aiming
        if (SAVE.filmStudy && (st.phase === 'angle' || st.phase === 'power')) {
            Composite.allBodies(engine.world).forEach(b => {
                if (b.gtype !== 'def' || b.elite || st.defs[b.di]?.ko) return;
                cx.fillStyle = 'rgba(226,60,80,0.07)';
                cx.beginPath(); cx.arc(b.position.x, b.position.y, 190, 0, Math.PI * 2); cx.fill();
                cx.strokeStyle = 'rgba(226,60,80,0.25)'; cx.lineWidth = 1.5; cx.setLineDash([5, 6]);
                cx.beginPath(); cx.arc(b.position.x, b.position.y, 190, 0, Math.PI * 2); cx.stroke();
                cx.setLineDash([]);
            });
        }
        // ── aim UI: sweeping arrow + runner at the ball ──
        const anchor = { x: st.scrimmage, y: (FT + FB) / 2 };
        if (st.phase === 'angle' || st.phase === 'power') {
            const ang = st.phase === 'angle' ? sweepAngle() : st.angle;
            const len = 112;
            const tipX = anchor.x + Math.cos(ang) * len, tipY = anchor.y + Math.sin(ang) * len;
            cx.strokeStyle = 'rgba(11,14,20,0.35)'; cx.lineWidth = 10; cx.lineCap = 'round';
            cx.beginPath(); cx.moveTo(anchor.x, anchor.y); cx.lineTo(tipX, tipY); cx.stroke();
            let pColor = st.phase === 'angle' ? '#FFE58A' : '#7FD4FF';
            if (st.phase === 'power') pColor = `hsl(${60 - st.pf * 60}, 100%, 60%)`;
            cx.strokeStyle = pColor; cx.lineWidth = st.phase === 'power' ? 6 + Math.sin(clock * 0.4) * 3 : 6;
            cx.beginPath(); cx.moveTo(anchor.x, anchor.y); cx.lineTo(tipX, tipY); cx.stroke();
            cx.fillStyle = pColor;
            cx.save(); cx.translate(tipX, tipY); cx.rotate(ang);
            cx.beginPath(); cx.moveTo(16, 0); cx.lineTo(-6, -11); cx.lineTo(-6, 11); cx.closePath(); cx.fill();
            cx.restore();
            // max-range ghost line for the selected runner
            const maxPx = RUNNERS[st.runnerType].maxYd * PXYD * (1 + SAVE.power * 0.15);
            cx.setLineDash([4, 8]); cx.strokeStyle = 'rgba(255,255,255,0.35)'; cx.lineWidth = 2;
            cx.beginPath(); cx.moveTo(anchor.x, anchor.y);
            cx.lineTo(anchor.x + Math.cos(ang) * maxPx, anchor.y + Math.sin(ang) * maxPx); cx.stroke();
            cx.setLineDash([]);
            shadow(anchor.x, anchor.y + 22, 15);
            const im = IMG['run_' + st.runnerType];
            if (!drawSprite(im, anchor.x, anchor.y - 16, 76, 76, 0, false)) {
                drawRunnerFB(anchor.x, anchor.y - 6, 76, 76, RUNNERS[st.runnerType].color, false, false, false);
            }
        }
        // trail
        fx.trail.forEach(t => {
            t.life--;
            if (st.pf > 0.85 && st.phase === 'flight') {
                cx.fillStyle = `rgba(255, ${Math.random()*150 + 50}, 0, ${Math.max(t.life, 0) / 40})`;
                cx.beginPath(); cx.arc(t.x + (Math.random()-0.5)*10, t.y + 10 + (Math.random()-0.5)*10, 8 + Math.random()*4, 0, Math.PI * 2); cx.fill();
            } else {
                cx.fillStyle = `rgba(255,255,255,${Math.max(t.life, 0) / 50})`;
                cx.beginPath(); cx.arc(t.x, t.y + 14, 6, 0, Math.PI * 2); cx.fill();
            }
        });
        fx.trail = fx.trail.filter(t => t.life > 0);
        // KO'd defenders
        st.defs.forEach(dd => {
            if (!dd.ko) return;
            const mk = levelMascot();
            const im = st.lockd ? IMG.teddy_ko : ((mk && IMG['mko_' + mk]) || IMG.def_ko);
            if (!drawSprite(im, dd.koX, dd.koY + 6, 84, 44, 0, false)) {
                drawDefKO(dd.koX, dd.koY + 8);
            }
        });
        // live bodies
        const step2 = (clock >> 3) & 1;
        Composite.allBodies(engine.world).forEach(b => {
            if (b.gtype === 'ghost') return;
            if (b.gtype === 'sled') {
                shadow(b.position.x, b.position.y + 18, 48);
                if (!drawSprite(IMG.sled, b.position.x, b.position.y - 2, 80, 80, 0, false))
                    drawSled(b.position.x, b.position.y);
            } else if (b.gtype === 'cones') {
                if (st.cones[b.ci]?.hit) return;
                shadow(b.position.x, b.position.y + 18, 16);
                if (!drawSprite(IMG.cones, b.position.x, b.position.y - 6, 40, 44, 0, false))
                    { cx.fillStyle = '#f5901e'; cx.beginPath(); cx.arc(b.position.x, b.position.y, 15, 0, Math.PI * 2); cx.fill(); }
            } else if (b.gtype === 'cooler') {
                if (b.hitT > 0) b.hitT--;
                const cwob = b.hitT > 0 ? Math.sin(b.hitT * 1.3) * 2 : 0;
                shadow(b.position.x, b.position.y + 20, 24);
                if (!drawSprite(IMG.cooler, b.position.x + cwob, b.position.y - 4, 60, 48, 0, false))
                    { cx.fillStyle = '#2E86D0'; cx.fillRect(b.position.x - 24, b.position.y - 22, 48, 44); }
            } else if (b.gtype === 'tire') {
                if (b.hitT > 0) b.hitT--;
                const tsc = b.hitT > 0 ? 1 + Math.sin(b.hitT) * 0.06 : 1;
                shadow(b.position.x, b.position.y + 18, 24);
                if (!drawSprite(IMG.tire, b.position.x, b.position.y, 56 * tsc, 36 * tsc, 0, false))
                    { cx.strokeStyle = '#c22f36'; cx.lineWidth = 9; cx.beginPath(); cx.arc(b.position.x, b.position.y, 20, 0, Math.PI * 2); cx.stroke(); }
            } else if (b.gtype === 'bumper') {
                if (b.hitT > 0) b.hitT--;
                const wob2 = b.hitT > 0 ? Math.sin(b.hitT * 1.4) * 3 : 0;
                shadow(b.position.x, b.position.y + 20, 20);
                if (!drawSprite(IMG.dummy, b.position.x + wob2, b.position.y - 4, 40, 36, wob2 * 0.02, false))
                    drawDummy(b.position.x + wob2, b.position.y - 4, wob2);
            } else if (b.gtype === 'wall') {
                if (b.hitT > 0) b.hitT--;
                const wob = b.hitT > 0 ? Math.sin(b.hitT * 1.2) * 2 : 0;
                shadow(b.position.x, b.position.y + 66, 16);
                cx.fillStyle = '#e8762c';
                cx.beginPath(); cx.roundRect(b.position.x - 10 + wob, b.position.y - 64, 20, 128, 6); cx.fill();
                cx.save(); cx.beginPath(); cx.roundRect(b.position.x - 10 + wob, b.position.y - 64, 20, 128, 6); cx.clip();
                cx.fillStyle = '#fff';
                for (let yy = -64; yy < 64; yy += 32) cx.fillRect(b.position.x - 10 + wob, b.position.y + yy, 20, 14);
                cx.restore();
                cx.strokeStyle = '#7c3a10'; cx.lineWidth = 2.5;
                cx.beginPath(); cx.roundRect(b.position.x - 10 + wob, b.position.y - 64, 20, 128, 6); cx.stroke();
                cx.fillStyle = '#7c3a10';
                cx.fillRect(b.position.x - 14 + wob, b.position.y + 60, 28, 5);
            } else if (b.gtype === 'ref') {
                shadow(b.position.x, b.position.y + 24, 15);
                if (!drawSprite(IMG.ref, b.position.x, b.position.y - 14, 56, 66, 0, st.phase === 'spot' ? 2 : false))
                    drawRef(b.position.x, b.position.y - 8, (clock >> 4) & 1);
            } else if (b.gtype === 'cheer') {
                shadow(b.position.x, b.position.y + 24, 14);
                const bob = Math.sin(clock * 0.12 + b.position.x) * 2;
                if (!drawSprite(IMG.cheer, b.position.x, b.position.y - 14 + bob, 56, 66, 0, true))
                    drawCheer(b.position.x, b.position.y - 8, (clock >> 4) & 1, bob);
            } else if (b.gtype === 'def') {
                if (st.defs[b.di]?.ko) return;
                const moving = Vector.magnitude(b.velocity) > 0.4;
                let jx = 0, jy = 0;
                if (!moving && st.phase !== 'over' && !st.lockd && clock % 4 === 0) { jx = (Math.random()-0.5)*3; jy = (Math.random()-0.5)*3; }
                shadow(b.position.x + jx, b.position.y + 20 + jy, 14);
                const mk = levelMascot();
                const im = st.lockd ? (b.elite ? (IMG.m_bear || IMG.def_elite) : IMG.teddy)
                                    : ((mk && IMG['m_' + mk]) || (b.elite ? IMG.def_elite : IMG.def_stand));
                if (!drawSprite(im, b.position.x + jx, b.position.y - 14 + jy, st.lockd ? 64 : 76, st.lockd ? 64 : 76, 0, moving))
                    drawDefender(b.position.x, b.position.y - 8, st.lockd ? 64 : 76, st.lockd ? 64 : 76, b.elite, moving && step2, moving && step2, jx, jy);
            } else if (b.gtype === 'runner') {
                const sp = Vector.magnitude(b.velocity);
                const moving = sp > 0.4;
                const sw = 76 * (1 + Math.min(sp, 20) * 0.006), sh = 76 * (1 - Math.min(sp, 20) * 0.004);
                shadow(b.position.x, b.position.y + 20, 14);
                if (st.breaks > 0) {
                    cx.strokeStyle = 'rgba(255,176,60,0.5)'; cx.lineWidth = 2.5;
                    cx.beginPath(); cx.arc(b.position.x, b.position.y, 22 + Math.sin(clock * 0.2) * 2, 0, Math.PI * 2); cx.stroke();
                }
                if (b.ghost > 0) { cx.globalAlpha = 0.65; }
                const im = IMG['run_' + b.rtype];
                if (!drawSprite(im, b.position.x, b.position.y - 12, sw, sh, b.ghost > 0 ? clock * 0.55 : 0, moving))
                    drawRunnerFB(b.position.x, b.position.y - 6, sw, sh, b.rcolor || RUNNERS[b.rtype].color, moving && step2, moving && step2, b.ghost > 0);
                cx.globalAlpha = 1;
            }
        });
        // particles / texts
        fx.parts = fx.parts.filter(p => p.life > 0);
        fx.parts.forEach(p => {
            p.life--; p.x += p.vx; p.y += p.vy;
            cx.globalAlpha = Math.min(p.life / 16, 1);
            cx.fillStyle = p.color;
            if (p.cloud) { cx.beginPath(); cx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); cx.fill(); }
            else { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot + p.life * 0.1); cx.fillRect(-p.sz/2, -p.sz/2, p.sz, p.sz); cx.restore(); }
            cx.globalAlpha = 1;
        });
        fx.texts = fx.texts.filter(t => t.life > 0);
        fx.texts.forEach(t => {
            t.life--; t.y -= 0.5;
            const progress = 1 - (t.life / t.maxLife);
            const scale = 1 + Math.sin(progress * Math.PI) * 0.5;
            cx.save(); cx.translate(t.x, t.y); cx.scale(scale, scale);
            cx.globalAlpha = Math.min(t.life / 25, 1);
            cx.fillStyle = t.color; cx.font = 'italic 900 20px Archivo'; cx.textAlign = 'center';
            cx.strokeStyle = 'rgba(0,0,0,0.8)'; cx.lineWidth = 4;
            cx.strokeText(t.txt, 0, 0); cx.fillText(t.txt, 0, 0);
            cx.restore();
        });
        cx.restore(); // camera
        // stadium light falloff
        const vg = cx.createLinearGradient(0, 0, 0, H);
        vg.addColorStop(0, 'rgba(6,10,18,0.35)'); vg.addColorStop(0.18, 'rgba(6,10,18,0)');
        vg.addColorStop(0.82, 'rgba(6,10,18,0)'); vg.addColorStop(1, 'rgba(6,10,18,0.35)');
        cx.fillStyle = vg; cx.fillRect(0, 0, W, H);

        // ── screen-space: power meter (classic kick bar) ──
        if (st.phase === 'power' || st.phase === 'angle') {
            const mx = 30, my = 120, mh = 300, mw = 30;
            cx.fillStyle = 'rgba(11,14,20,0.75)';
            cx.beginPath(); cx.roundRect(mx - 8, my - 30, mw + 16, mh + 52, 10); cx.fill();
            cx.fillStyle = '#fff'; cx.font = 'bold 11px Archivo'; cx.textAlign = 'center';
            cx.fillText('PWR', mx + mw / 2, my - 12);
            const grad = cx.createLinearGradient(0, my + mh, 0, my);
            grad.addColorStop(0, '#3fbf52'); grad.addColorStop(0.55, '#f5d312'); grad.addColorStop(1, '#e2413a');
            cx.fillStyle = 'rgba(255,255,255,0.12)';
            cx.fillRect(mx, my, mw, mh);
            const pf = st.phase === 'power' ? sweepPower() : 0;
            cx.fillStyle = grad;
            cx.fillRect(mx, my + mh * (1 - pf), mw, mh * pf);
            cx.strokeStyle = 'rgba(255,255,255,0.5)'; cx.lineWidth = 1;
            for (let i = 1; i < 10; i++) { cx.beginPath(); cx.moveTo(mx, my + mh * i / 10); cx.lineTo(mx + mw, my + mh * i / 10); cx.stroke(); }
            cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.strokeRect(mx, my, mw, mh);
            if (st.phase === 'power') {
                cx.fillStyle = '#fff';
                cx.beginPath(); cx.moveTo(mx - 7, my + mh * (1 - pf)); cx.lineTo(mx - 16, my + mh * (1 - pf) - 7); cx.lineTo(mx - 16, my + mh * (1 - pf) + 7); cx.closePath(); cx.fill();
            }
            cx.fillStyle = '#7FD4FF'; cx.font = '10px JetBrains Mono';
            cx.fillText(RUNNERS[st.runnerType].maxYd + 'yd max', mx + mw / 2, my + mh + 16);
            cx.textAlign = 'left';
        }
        // scoreboard
        cx.fillStyle = 'rgba(11,14,20,0.6)';
        cx.beginPath(); cx.roundRect(W - 292, 8, 280, 58, 9); cx.fill();
        cx.fillStyle = '#FFE58A'; cx.font = 'italic 900 14px Archivo'; cx.textAlign = 'right';
        const sbParts = teamParts(TEAMS[level].team);
        cx.fillText(sbParts.location.toUpperCase() + ' ' + sbParts.mascot.toUpperCase(), W - 28, 26);
        cx.font = '10px JetBrains Mono'; cx.fillStyle = 'rgba(255,255,255,0.7)';
        cx.fillText('D-SCORE ' + TEAMS[level].score.toFixed(2) + ' · RANK #' + (N() - level), W - 28, 41);
        const curX = st.runner ? st.runner.position.x : st.scrimmage;
        cx.fillStyle = '#7FD4FF';
        cx.fillText(downLabel() + ' · BALL ON ' + spotName(curX) + ' · ' + Math.max(0, Math.round(100 - ydAt(curX))) + ' TO GO', W - 28, 56);
        cx.textAlign = 'left';
        cx.fillStyle = 'rgba(11,14,20,0.5)'; cx.beginPath(); cx.roundRect(W/2 - 160, H - 18, 320, 10, 5); cx.fill();
        cx.fillStyle = '#E8C547';
        cx.beginPath(); cx.roundRect(W/2 - 158, H - 16, 316 * Math.min(ydAt(Math.max(curX, st.bestX)), 100) / 100, 6, 3); cx.fill();
        cx.restore();
    }

    // ── ui ──────────────────────────────────────────────────────────────────
    const $g = id => root ? root.querySelector('#' + id) : null;
    function setMsg(m) { const el = $g('ag-msg'); if (el) el.textContent = m; }
    function updateHUD() {
        if (level == null || !root || !st) return;
        $g('ag-vs').textContent = 'YOU vs ' + TEAMS[level].team.toUpperCase();
        $g('ag-shots').textContent = downLabel() + ' of ' + st.maxDowns;
        $g('ag-yards').textContent = SAVE.yards + ' YDS';
        const r = RUNNERS[st.runnerType];
        $g('ag-abil').textContent = st.phase === 'flight'
            ? 'BREAKS ' + '●'.repeat(st.breaks) + '○'.repeat(Math.max(effBreaks(st.runnerType) - st.breaks, 0))
              + (SAVE.spinMove ? (st.spinUsed ? ' · SPIN USED' : ' · TAP = SPIN MOVE') : '')
            : st.phase === 'power' ? 'TAP TO LOCK POWER!'
            : r.label + ': ' + effMaxYd(st.runnerType) + ' yd max · breaks ' + effBreaks(st.runnerType);
    }
    function drawPicker() {
        const bb = $g('ag-ballbar'); if (!bb || !st) return;
        bb.innerHTML = Object.entries(RUNNERS).map(([k, r]) =>
            `<button class="pill ${st.runnerType === k ? 'pill-active' : ''}" ${st.phase !== 'angle' ? 'disabled style="opacity:0.4"' : ''}
                onclick="ARCADE.pick('${k}')">${r.label} · ${effMaxYd(k)}yd · ${'✊'.repeat(effBreaks(k)) || '—'}</button>`).join('');
    }
    function overlayHTML(html, full = false) {
        const ov = $g('ag-overlay');
        ov.classList.remove('hidden');
        ov.innerHTML = full ? html : `<div class="ag-panel" id="ag-obody">${html}</div>`;
    }
    function hideOverlay() { $g('ag-overlay').classList.add('hidden'); }

    function titleScreen() {
        overlayHTML(`
            <div style="position:relative;width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#04060A;cursor:pointer;" onclick="ARCADE.ladder()">
                <h1 class="display" style="font-size:8vmin;color:#fff;text-transform:uppercase;text-shadow:0 4px 16px rgba(232,197,71,0.6);margin-bottom:12px;letter-spacing:-2px;text-align:center;">Endzone <span style="color:#E8C547">Run</span></h1>
                <p style="color:#7FD4FF;font-weight:700;font-size:3vmin;letter-spacing:4px;margin-bottom:8vh;text-align:center;">ARCADE FOOTBALL</p>
                <div style="animation: pulse 1.5s infinite; color:#E8C547; font-weight:900; font-size:4vmin; letter-spacing:2px; font-style:italic;text-align:center;">PRESS START TO PLAY</div>
                <style>@keyframes pulse { 0%, 100% { opacity:1; } 50% { opacity:0; } }</style>
            </div>
        `, true);
    }

    function ladder() {
        const nodes = TEAMS.map((t, i) => {
            const lk = i + 1 > SAVE.unlocked, stars = SAVE.stars[i] || 0;
            const row = Math.floor(i / 5), col = i % 5;
            const py = 20 + row * 20; // 20%, 40%, 60%, 80%
            let px = row % 2 === 0 ? 12 + col * 19 : 88 - (col * 19);
            if (row === 3) px = 88 - (col * 22); // spread 4 items
            return { px, py, lk, stars, t, i, col: lk ? '#333' : t.color, col2: lk ? '#111' : t.color2 };
        });
        let svgLines = '';
        for (let j = 0; j < nodes.length - 1; j++) {
            svgLines += `<path d="M${nodes[j].px},${nodes[j].py} C${nodes[j].px},${nodes[j].py+10} ${nodes[j+1].px},${nodes[j+1].py-10} ${nodes[j+1].px},${nodes[j+1].py}" stroke="${nodes[j+1].lk?'#333':'#7FD4FF'}" stroke-width="0.8" fill="none" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>`;
        }
        const htmlNodes = nodes.map(n => `
            <div style="position:absolute;left:${n.px}%;top:${n.py}%;transform:translate(-50%,-50%);
                        width:8vmin;height:8vmin;min-width:40px;min-height:40px;border-radius:50%;background:${n.col};border:0.6vmin solid ${n.col2};
                        display:flex;align-items:center;justify-content:center;cursor:${n.lk?'default':'pointer'};
                        box-shadow:0 6px 12px rgba(0,0,0,0.5);"
                 ${n.lk ? '' : `onclick="ARCADE.start(${n.i})"`}>
                 <span style="color:#fff;font-weight:900;font-size:3vmin;text-shadow:1px 1px 0 #000">${N()-n.i}</span>
                 ${n.lk ? '<i class="fa-solid fa-lock" style="position:absolute;bottom:-15%;font-size:2vmin;color:#fff;"></i>' : ''}
                 ${n.stars > 0 ? `<div style="position:absolute;top:-15%;color:#E8C547;font-size:2vmin;text-shadow:0 2px 4px #000">${'★'.repeat(n.stars)}</div>` : ''}
            </div>
            <div style="position:absolute;left:${n.px}%;top:calc(${n.py}% + 5vmin);transform:translateX(-50%);
                        white-space:nowrap;font-size:1.8vmin;font-weight:700;color:${n.lk?'#666':'#fff'};text-shadow:0 1px 3px rgba(0,0,0,0.8);">${esc(n.t.team.toUpperCase())}</div>
        `).join('');
        overlayHTML(`
            <div style="position:relative;width:100vw;height:100vh;background:#1a2230;overflow:hidden;display:flex;flex-direction:column;">
                <div style="position:absolute;top:max(env(safe-area-inset-top), 2vmin);left:max(env(safe-area-inset-left), 3vmin);z-index:2;">
                    <h2 class="display" style="color:#fff;font-size:4vmin;text-transform:uppercase;margin:0;">Endzone <span style="color:#E8C547">Run</span></h2>
                </div>
                <div style="position:absolute;top:max(env(safe-area-inset-top), 2vmin);right:max(env(safe-area-inset-right), 3vmin);display:flex;gap:1.5vmin;align-items:center;z-index:2;">
                    <div style="background:rgba(0,0,0,0.5);padding:1vmin 2vmin;border-radius:99px;color:#34D399;font-weight:700;font-size:2vmin;border:1px solid rgba(255,255,255,0.1)">${SAVE.yards} YDS</div>
                    <button class="pill" style="font-size:2vmin;padding:1vmin 2vmin;" onclick="ARCADE.lockerRoom()">Locker Room</button>
                    <button class="pill" style="font-size:2vmin;padding:1vmin 2vmin;" onclick="ARCADE.reset()">Reset</button>
                </div>
                <div style="position:relative;width:100%;flex:1;margin-top:8vmin;">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">${svgLines}</svg>
                    ${htmlNodes}
                </div>
            </div>
        `, true);
    }

    function lockerRoom() {
        const item = (label, desc, cost, owned, key) => `
            <div class="ag-shopitem"><div><div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:2px">${label}</div>
            <div style="color:#A0AABF;font-size:11px">${desc}</div></div>
            ${owned ? '<span style="color:#34D399;font-size:12px;font-weight:700">OWNED</span>'
                    : `<button class="pill" ${SAVE.yards < cost ? 'disabled style="opacity:0.4;filter:grayscale(1)"' : ''} onclick="ARCADE.buy('${key}',${cost})">${cost} YDS</button>`}</div>`;
        const powCost = [400, 850, 1500][SAVE.power] || 0;
        overlayHTML(`<p class="ag-sub">Locker Room · <span style="color:#34D399">${SAVE.yards} YARDS</span></p>
            ${item('Leg Day ' + 'I'.repeat(Math.min(SAVE.power + 1, 3)), '+15% max distance per tier (all runners)', powCost, SAVE.power >= 3, 'power')}
            ${item('Elite Cleats', '+8% distance and better turf grip', 600, SAVE.cleats, 'cleats')}
            ${item('Bruiser Package', 'RB gains a 3rd tackle break', 1200, SAVE.bruiser, 'bruiser')}
            ${item('Soft Hands', 'TE gains a 2nd tackle break', 1000, SAVE.softHands, 'softHands')}
            ${item('Track Star', 'WR max range 60 → 70 yards', 1000, SAVE.trackStar, 'trackStar')}
            ${item('Film Study', 'See every defender’s pursuit range while you aim', 750, SAVE.filmStudy, 'filmStudy')}
            ${item('Spin Move', 'Once per down: tap mid-run to spin through a tackle untouched', 1800, SAVE.spinMove, 'spinMove')}
            ${item('Wrecking Crew', 'Hit sleds and barriers at speed to smash them — gone for the whole drive', 1400, SAVE.wrecker, 'wrecker')}
            ${item('Move the Chains', 'Cross midfield and the crew resets the sticks — a fresh set of downs, once per drive', 2500, SAVE.chains, 'chains')}
            <div class="ag-btns" style="margin-top:10px">
                <button class="pill" onclick="ARCADE.ladder()">Back to Map</button>
                ${level != null ? `<button class="pill" onclick="ARCADE.start(${level})">Replay level</button>` : ''}
            </div>`);
    }



    // ── VS screen between levels ─────────────────────────────────────────
    function vsScreen() {
        const team = TEAMS[level];
        const mk = levelMascot();
        const mfile = st.lockd ? 'assets/m_bear.png' : (mk ? 'assets/m_' + mk + '.png' : 'assets/def_stand.png');
        const mimg = st.lockd ? IMG.m_bear : (mk ? IMG['m_' + mk] : IMG.def_stand);
        const rimg = IMG['run_' + st.runnerType];
        const box = (file, img, flip) => {
            const two = img && img.frames === 2;
            return `<div style="width:150px;height:150px;margin:0 auto;image-rendering:pixelated;
                background:url('${file}') no-repeat ${two ? '0 bottom' : 'center bottom'};
                background-size:${two ? '200% auto' : 'contain'};
                ${two ? 'animation:agvs 0.55s steps(1) infinite;' : ''}
                ${flip ? 'transform:scaleX(-1);' : ''}"></div>`;
        };
        overlayHTML(`
            <style>@keyframes agvs { 0%,100% { background-position: 0 bottom; } 50% { background-position: -150px bottom; } }</style>
            <div style="text-align:center">
                <p class="ag-sub" style="text-align:center">GAME ${level + 1} OF ${N()} · THEY RANK #${N() - level} ALL-TIME</p>
                <div style="display:flex;align-items:center;justify-content:center;gap:14px">
                    <div style="flex:1;min-width:0">
                        ${box('assets/run_' + st.runnerType + '.png', rimg, false)}
                        <p class="display" style="color:#7FD4FF;font-size:16px;text-transform:uppercase;margin-top:6px">YOU</p>
                        <p class="ag-sub" style="text-align:center;margin:2px 0 0">${RUNNERS[st.runnerType].label} · ${effMaxYd(st.runnerType)} YD · ${'✊'.repeat(effBreaks(st.runnerType)) || 'NO'} BREAKS</p>
                    </div>
                    <div class="display" style="font-size:44px;color:#E8C547;font-style:italic;text-shadow:2px 2px 0 rgba(0,0,0,0.5)">VS</div>
                    <div style="flex:1;min-width:0">
                        ${box(mfile, mimg, true)}
                        <p class="display" style="color:#FF6B57;font-size:15px;text-transform:uppercase;margin-top:6px">${esc(team.team)}</p>
                        <p class="ag-sub" style="text-align:center;margin:2px 0 0">${st.lockd ? 'UNDEFEATED · ALWAYS · FOREVER' : 'D-SCORE ' + team.score.toFixed(0)}</p>
                    </div>
                </div>
                <div class="ag-btns" style="justify-content:center;margin-top:14px">
                    <button class="pill pill-active" onclick="ARCADE.kickoff()">Kick off</button>
                    <button class="pill" onclick="ARCADE.ladder()">Back</button>
                </div>
            </div>`);
    }

    // ── lifecycle ───────────────────────────────────────────────────────────
    function loop(now) {
        if (!active) return;
        let dt = Math.min(now - lastT, 60); lastT = now;
        clock++;
        if (engine && st && st.phase !== 'over') {
            acc += dt;
            let steps = 0;
            while (acc >= STEP && steps < 3) { Engine.update(engine, STEP); tickTurn(STEP); acc -= STEP; steps++; }
            if (steps === 3) acc = 0;
        }
        if (st) {
            const focus = st.runner ? st.runner.position.x : (st.focusX ?? st.scrimmage);
            const target = Math.max(0, Math.min(focus - 360, L - W));
            cam += (target - cam) * 0.09;
            if (Math.abs(target - cam) < 0.5) cam = target;
            
            let targetZoom = 1.0;
            if (st.phase === 'flight') targetZoom = 1.04;
            if (st.phase === 'spot') targetZoom = 1.08;
            camZoom += (targetZoom - camZoom) * 0.1;
        }
        try {
            draw();
            mainCx.imageSmoothingEnabled = false;
            mainCx.clearRect(0, 0, W, H);
            mainCx.drawImage(buf, 0, 0, W, H);
            mainCx.globalAlpha = 0.10;
            mainCx.drawImage(scan, 0, 0);
            mainCx.globalAlpha = 1;
        } catch (e) { console.error('draw error:', e); }
        raf = requestAnimationFrame(loop);
    }

    function mount(container) {
        try { SAVE = Object.assign({}, DEFSAVE, JSON.parse(localStorage.getItem('endzone_run_v1') || '{}')); }
        catch (e) { SAVE = { ...DEFSAVE }; }
        if (SAVE.customPlayers) { delete SAVE.customPlayers; persist(); }
        TEAMS = [...(window.DYNASTY_RANKS || ER_TEAMS)].sort((a, b) => a.score - b.score);
        calibrate();
        root = container;
        root.innerHTML = `
            <style>
            .ag-wrap { position:relative; aspect-ratio:1024/576; overflow:hidden; margin:0 auto; border-radius:12px;
                        width:min(1024px, 100%, calc((100dvh - 120px) * 1.7778)); }
            .ag-wrap canvas { display:block; width:100%; height:100%; touch-action:none; }
            @media (orientation: landscape) and (max-height: 560px) {
                .ag-wrap { width:min(calc(100vw - 8px), calc((100dvh - 8px) * 1.7778)); border-radius:0; }
            }
            @media (max-width: 760px) {
                .ag-chip { font-size:9px; padding:4px 8px; border-radius:8px; }
                .ag-chip .display { font-size:11px !important; }
                .ag-hud { padding:8px !important; }
                .ag-hud .pill, .ag-ballbar .pill { font-size:8px; padding:4px 8px; letter-spacing:0.05em; }
                .ag-ballbar { bottom:16px !important; left:8px !important; gap:4px; }
                .ag-msg { font-size:8px; max-width:34%; bottom:16px !important; right:8px !important; padding:3px 7px; }
            }
            .ag-hud { position:absolute; top:0; left:0; right:0; display:flex; justify-content:space-between;
                      padding:safe area inset top 16px; padding:calc(env(safe-area-inset-top) + 16px) calc(env(safe-area-inset-right) + 16px) 16px calc(env(safe-area-inset-left) + 16px); pointer-events:none; z-index:2; }
            .ag-hud > div { pointer-events:auto; display:flex; flex-direction:column; gap:6px; }
            .ag-chip { background:rgba(0,0,0,0.3); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
                       border:1px solid rgba(255,255,255,0.15); border-radius:12px;
                       padding:6px 12px; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.2); }
            .ag-ballbar { position:absolute; bottom:calc(env(safe-area-inset-bottom) + 26px); left:calc(env(safe-area-inset-left) + 16px); display:flex; gap:8px; flex-wrap:wrap; z-index:2; }
            .ag-msg { position:absolute; bottom:calc(env(safe-area-inset-bottom) + 26px); right:calc(env(safe-area-inset-right) + 16px); font-family:'Inter',sans-serif; font-size:11px; font-weight:700;
                      color:#111; background:rgba(255,255,255,0.9); backdrop-filter:blur(8px); padding:6px 12px; border-radius:8px;
                      text-transform:uppercase; letter-spacing:0.1em; text-align:right; max-width:44%; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:2; }
            .ag-overlay { position:absolute; inset:0; background:rgba(4,6,10,0.5); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                          display:flex; align-items:center; justify-content:center; overflow-y:auto; z-index:10; }
            .ag-overlay.hidden { display:none; }
            .ag-panel { background:rgba(25,30,40,0.6); border:1px solid rgba(255,255,255,0.15); border-top:1px solid rgba(255,255,255,0.3);
                        box-shadow:0 20px 40px rgba(0,0,0,0.5); border-radius:24px;
                        padding:24px; max-width:560px; width:90%; max-height:90%; overflow-y:auto; color:#fff; }
            .ag-sub { font-family:'Inter',sans-serif; font-size:11px; font-weight:600; text-transform:uppercase;
                      letter-spacing:0.1em; color:#A0AABF; margin-bottom:16px; }
            .ag-row { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:12px;
                      background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.08); margin-bottom:6px; cursor:pointer; transition:all 0.2s ease; }
            .ag-row:hover { border-color:rgba(232,197,71,0.6); background:rgba(232,197,71,0.1); transform:translateX(4px); }
            .ag-locked { opacity:0.4; cursor:default; pointer-events:none; filter:grayscale(1); }
            .ag-shopitem { display:flex; justify-content:space-between; align-items:center; gap:12px;
                           padding:12px 16px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.08); border-radius:14px; margin-bottom:8px; }
            .ag-btns { display:flex; gap:10px; flex-wrap:wrap; margin-top:20px; }
            </style>
            <div class="ag-wrap">
                <canvas id="ag-canvas" width="${W}" height="${H}"></canvas>
                <div class="ag-hud">
                    <div style="align-items:flex-start">
                        <div class="ag-chip"><span id="ag-vs" class="display" style="font-size:15px;text-shadow:0 2px 4px rgba(0,0,0,0.5)"></span></div>
                        <div class="ag-chip"><span id="ag-shots" style="color:#E8C547"></span> <span style="opacity:0.5">·</span> <span id="ag-yards" style="color:#34D399"></span></div>
                        <div class="ag-chip" id="ag-abil" style="color:#7FD4FF"></div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:flex-end">
                        <button class="pill" onclick="ARCADE.fs()" title="Fullscreen — best on a landscape phone">Full Screen</button>
                        <button class="pill" onclick="ARCADE.ladder()">Map</button>
                        <button class="pill" onclick="ARCADE.retry()">Restart</button>
                    </div>
                </div>
                <div class="ag-ballbar" id="ag-ballbar"></div>
                <div class="ag-msg" id="ag-msg"></div>
                <div class="ag-overlay" id="ag-overlay"><div class="ag-panel" id="ag-obody"></div></div>
            </div>`;
        cv = $g('ag-canvas');
        cv.style.imageRendering = 'auto';
        mainCx = cv.getContext('2d');
        buf = document.createElement('canvas');
        buf.width = Math.round(W * RES); buf.height = Math.round(H * RES);
        cx = buf.getContext('2d');
        scan = document.createElement('canvas');
        scan.width = W; scan.height = H;
        const sc = scan.getContext('2d');
        sc.fillStyle = '#000';
        for (let y = 0; y < H; y += 4) sc.fillRect(0, y, W, 1);
        cv.addEventListener('mousedown', onDown);
        cv.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('keydown', onKey);
        active = true; lastT = performance.now(); acc = 0; cam = 0;
        fx = { parts: [], texts: [], shake: 0, trail: [] };
        raf = requestAnimationFrame(loop);
        titleScreen();
    }
    function unmount() {
        active = false;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        engine = null; st = null; level = null; root = null; cv = null; cx = null; fx = null;
    }

    return {
        mount, unmount,
        get active() { return active; },
        fs: () => {
            const wrap = root && root.querySelector('.ag-wrap');
            if (!wrap) return;
            if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
            (wrap.requestFullscreen || wrap.webkitRequestFullscreen)?.call(wrap);
            try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) {}
        },
        lockerRoom: () => { active = false; lockerRoom(); },
        start: i => { buildLevel(i); vsScreen(); },
        kickoff: () => { hideOverlay(); },
        retry: () => { if (level != null) buildLevel(level); },
        ladder, lockerRoom, titleScreen,
        pick: k => { if (st && st.phase === 'angle') { st.runnerType = k; drawPicker(); updateHUD(); } },
        buy: (k, cost) => {
            if (SAVE.yards < cost) return;
            SAVE.yards -= cost;
            if (k === 'power') SAVE.power++; else SAVE[k] = true;
            calibrate();
            persist(); lockerRoom();
        },
        reset: () => { if (confirm('Wipe all arcade progress?')) { localStorage.removeItem('endzone_run_v1'); SAVE = { ...DEFSAVE }; calibrate(); titleScreen(); } }
    };
})();

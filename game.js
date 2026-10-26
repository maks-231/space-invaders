(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const $ = id => document.getElementById(id);
  const overlay = $("overlay"), msg = $("msg"), sub = $("sub");

  // Pixel sprites (11x8 style invaders)
  const SPRITES = [
    [ // squid-ish
      "00100000100", "00010001000", "00111111100", "01101110110",
      "11111111111", "10111111101", "10100000101", "00011011000"],
    [ // crab-ish
      "00100000100", "10010001001", "10111111101", "11101110111",
      "11111111111", "01111111110", "00100000100", "01000000010"],
    [ // octopus-ish
      "00001111000", "01111111111", "11111111111", "11100110011",
      "11111111111", "00011011000", "00110110110", "11000000011"],
  ];
  const ROWS_TYPE = [0, 1, 1, 2, 2];
  const ROW_POINTS = [30, 20, 20, 10, 10];
  const COLS = 10, PX = 2.4;
  const IW = 11 * PX, IH = 8 * PX;

  let state, keys = {}, hi = +localStorage.getItem("si-hi") || 0;
  $("hi").textContent = hi;

  // Audio (tiny beeps)
  let actx;
  function beep(freq, dur, type = "square", vol = 0.05) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }

  function makeShields() {
    const shields = [];
    for (let i = 0; i < 4; i++) {
      const bx = 60 + i * 150, by = H - 130;
      const cells = [];
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 16; c++) {
          // carve an arch at the bottom
          if (r >= 7 && c >= 5 && c <= 10) continue;
          // round the top corners
          if (r < 2 && (c < 2 - r || c > 13 + r)) continue;
          cells.push({ x: bx + c * 4, y: by + r * 4, hp: 2 });
        }
      shields.push(...cells);
    }
    return shields;
  }

  function makeInvaders(level) {
    const inv = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < COLS; c++)
        inv.push({
          x: 50 + c * 46, y: 60 + r * 36 + Math.min(level - 1, 5) * 10,
          row: r, alive: true,
        });
    return inv;
  }

  function reset() {
    state = {
      mode: "menu", score: 0, lives: 3, level: 1,
      player: { x: W / 2 - 15, y: H - 40, w: 30, h: 16, cooldown: 0, invuln: 0 },
      bullets: [], enemyBullets: [], particles: [],
      invaders: makeInvaders(1), shields: makeShields(),
      dir: 1, frame: 0, moveTimer: 0, ufo: null, ufoTimer: 15 * 60,
      stars: Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + .3 })),
    };
    updateHud();
  }

  function updateHud() {
    $("score").textContent = state.score;
    $("level").textContent = state.level;
    $("lives").textContent = state.lives;
    $("hi").textContent = hi;
  }

  function show(title, text) {
    msg.textContent = title; sub.textContent = text;
    overlay.classList.remove("hidden");
  }

  function start() {
    if (state.mode === "playing") return;
    if (state.mode === "over" || state.mode === "menu") {
      const keepStars = state.stars; reset(); state.stars = keepStars;
    }
    state.mode = "playing";
    overlay.classList.add("hidden");
  }

  function explode(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 3 + .5;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 20, color });
    }
  }

  function shoot() {
    const p = state.player;
    if (p.cooldown > 0 || state.bullets.length >= 2) return;
    state.bullets.push({ x: p.x + p.w / 2 - 1.5, y: p.y - 8, w: 3, h: 10 });
    p.cooldown = 18;
    beep(880, .1);
  }

  function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update() {
    const s = state;
    s.stars.forEach(st => { st.y += st.s * .3; if (st.y > H) st.y = 0; });
    s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
    s.particles = s.particles.filter(p => p.life > 0);
    if (s.mode !== "playing") return;

    const p = s.player;
    if (keys.left) p.x -= 4;
    if (keys.right) p.x += 4;
    p.x = Math.max(8, Math.min(W - p.w - 8, p.x));
    if (keys.fire) shoot();
    if (p.cooldown > 0) p.cooldown--;
    if (p.invuln > 0) p.invuln--;

    // Player bullets
    for (const b of s.bullets) b.y -= 8;
    s.bullets = s.bullets.filter(b => b.y + b.h > 0);

    // Enemy bullets
    for (const b of s.enemyBullets) b.y += 3 + s.level * .2;
    s.enemyBullets = s.enemyBullets.filter(b => b.y < H);

    // Invader movement: speed grows as fewer remain
    const alive = s.invaders.filter(i => i.alive);
    const total = COLS * 5;
    const delay = Math.max(2, Math.floor((alive.length / total) * 40) - s.level * 2);
    if (++s.moveTimer >= delay) {
      s.moveTimer = 0; s.frame ^= 1;
      let minX = Infinity, maxX = -Infinity;
      alive.forEach(i => { minX = Math.min(minX, i.x); maxX = Math.max(maxX, i.x + IW); });
      const step = 6 * s.dir;
      if ((s.dir > 0 && maxX + step > W - 8) || (s.dir < 0 && minX + step < 8)) {
        s.dir *= -1;
        alive.forEach(i => i.y += 14);
      } else alive.forEach(i => i.x += step);
      beep(100 + (s.frame ? 20 : 0), .05, "square", .04);
    }

    // Enemy firing from lowest invader per column
    if (alive.length && Math.random() < 0.015 + s.level * 0.003) {
      const cols = {};
      alive.forEach(i => { const c = Math.round(i.x / 46); if (!cols[c] || i.y > cols[c].y) cols[c] = i; });
      const keys2 = Object.keys(cols);
      const sh = cols[keys2[Math.floor(Math.random() * keys2.length)]];
      s.enemyBullets.push({ x: sh.x + IW / 2 - 1.5, y: sh.y + IH, w: 3, h: 10 });
    }

    // UFO
    if (!s.ufo && --s.ufoTimer <= 0) {
      const dir = Math.random() < .5 ? 1 : -1;
      s.ufo = { x: dir > 0 ? -40 : W, y: 36, w: 36, h: 14, vx: dir * 2 };
      s.ufoTimer = (15 + Math.random() * 10) * 60;
    }
    if (s.ufo) {
      s.ufo.x += s.ufo.vx;
      if (s.ufo.x < -60 || s.ufo.x > W + 20) s.ufo = null;
    }

    // Player bullets vs things
    for (const b of s.bullets) {
      if (b.dead) continue;
      for (const i of alive) {
        if (i.alive && hit(b, { x: i.x, y: i.y, w: IW, h: IH })) {
          i.alive = false; b.dead = true;
          s.score += ROW_POINTS[i.row];
          explode(i.x + IW / 2, i.y + IH / 2, "#7CFC00");
          beep(220, .12, "sawtooth");
          break;
        }
      }
      if (b.dead) continue;
      if (s.ufo && hit(b, s.ufo)) {
        const pts = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
        s.score += pts; b.dead = true;
        explode(s.ufo.x + 18, s.ufo.y + 7, "#f33", 24);
        beep(440, .3, "sawtooth");
        s.ufo = null;
        continue;
      }
      for (const c of s.shields) {
        if (c.hp > 0 && hit(b, { x: c.x, y: c.y, w: 4, h: 4 })) {
          c.hp--; b.dead = true; break;
        }
      }
    }
    s.bullets = s.bullets.filter(b => !b.dead);

    // Enemy bullets vs shields / player
    for (const b of s.enemyBullets) {
      for (const c of s.shields) {
        if (c.hp > 0 && hit(b, { x: c.x, y: c.y, w: 4, h: 4 })) {
          c.hp--; b.dead = true;
          // splash damage
          s.shields.forEach(o => { if (o.hp > 0 && o !== c && Math.abs(o.x - c.x) <= 4 && Math.abs(o.y - c.y) <= 4 && Math.random() < .5) o.hp--; });
          break;
        }
      }
      if (!b.dead && p.invuln <= 0 && hit(b, p)) {
        b.dead = true; playerHit();
      }
    }
    s.enemyBullets = s.enemyBullets.filter(b => !b.dead);
    s.shields = s.shields.filter(c => c.hp > 0);

    // Invaders reaching shields / ground
    for (const i of alive) {
      if (!i.alive) continue;
      s.shields = s.shields.filter(c => !hit({ x: i.x, y: i.y, w: IW, h: IH }, { x: c.x, y: c.y, w: 4, h: 4 }));
      if (i.y + IH >= p.y) { s.lives = 0; gameOver(); return; }
    }

    // Level cleared
    if (!s.invaders.some(i => i.alive)) {
      s.level++;
      s.invaders = makeInvaders(s.level);
      s.bullets = []; s.enemyBullets = [];
      s.shields = makeShields();
      s.dir = 1;
      beep(660, .3, "triangle", .08);
    }
    updateHud();
  }

  function playerHit() {
    const s = state, p = s.player;
    s.lives--;
    explode(p.x + p.w / 2, p.y + p.h / 2, "#0ff", 30);
    beep(80, .5, "sawtooth", .08);
    p.invuln = 90;
    s.enemyBullets = [];
    updateHud();
    if (s.lives <= 0) gameOver();
  }

  function gameOver() {
    state.mode = "over";
    if (state.score > hi) { hi = state.score; localStorage.setItem("si-hi", hi); }
    updateHud();
    show("GAME OVER", `Score ${state.score} — press ENTER to play again`);
  }

  function drawSprite(sprite, x, y, color) {
    ctx.fillStyle = color;
    for (let r = 0; r < sprite.length; r++)
      for (let c = 0; c < sprite[r].length; c++)
        if (sprite[r][c] === "1") ctx.fillRect(Math.round(x + c * PX), Math.round(y + r * PX), Math.ceil(PX), Math.ceil(PX));
  }

  function draw() {
    const s = state;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    s.stars.forEach(st => ctx.fillRect(st.x, st.y, st.s, st.s));

    // ground line
    ctx.fillStyle = "#7CFC00"; ctx.fillRect(0, H - 14, W, 2);

    // invaders
    const colors = ["#f0f", "#0ff", "#0ff", "#7CFC00", "#7CFC00"];
    for (const i of s.invaders) {
      if (!i.alive) continue;
      let spr = SPRITES[ROWS_TYPE[i.row]];
      if (s.frame) spr = spr.map(r => r.split("").reverse().join("")).map((r, k) => k >= 5 ? r : spr[k]);
      drawSprite(spr, i.x, i.y, colors[i.row]);
    }

    // shields
    ctx.fillStyle = "#7CFC00";
    for (const c of s.shields) {
      ctx.globalAlpha = c.hp === 2 ? 1 : .5;
      ctx.fillRect(c.x, c.y, 4, 4);
    }
    ctx.globalAlpha = 1;

    // UFO
    if (s.ufo) {
      const u = s.ufo;
      ctx.fillStyle = "#f33";
      ctx.beginPath(); ctx.ellipse(u.x + 18, u.y + 8, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(u.x + 18, u.y + 5, 8, 6, 0, Math.PI, 0); ctx.fill();
    }

    // player
    const p = s.player;
    if (s.mode !== "over" && !(p.invuln > 0 && Math.floor(p.invuln / 5) % 2)) {
      ctx.fillStyle = "#0ff";
      ctx.fillRect(p.x, p.y + 8, p.w, 8);
      ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, 6);
      ctx.fillRect(p.x + p.w / 2 - 2, p.y - 2, 4, 8);
    }

    // bullets
    ctx.fillStyle = "#fff";
    s.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.fillStyle = "#ff0";
    s.enemyBullets.forEach(b => {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillRect(b.x - 2, b.y + 3, 7, 2);
    });

    // particles
    s.particles.forEach(pt => {
      ctx.globalAlpha = Math.min(1, pt.life / 25);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 3, 3);
    });
    ctx.globalAlpha = 1;
  }

  function loop() {
    update(); draw();
    requestAnimationFrame(loop);
  }

  // Input
  const map = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", " ": "fire" };
  addEventListener("keydown", e => {
    if (map[e.key]) { keys[map[e.key]] = true; e.preventDefault(); }
    if (e.key === "Enter") start();
    if (e.key === " " && state.mode !== "playing" && state.mode !== "paused") start();
    if ((e.key === "p" || e.key === "P")) {
      if (state.mode === "playing") { state.mode = "paused"; show("PAUSED", "Press P to resume"); }
      else if (state.mode === "paused") { state.mode = "playing"; overlay.classList.add("hidden"); }
    }
  });
  addEventListener("keyup", e => { if (map[e.key]) keys[map[e.key]] = false; });
  overlay.addEventListener("click", () => {
    if (state.mode === "paused") { state.mode = "playing"; overlay.classList.add("hidden"); }
    else start();
  });

  // Touch buttons
  [["bl", "left"], ["br", "right"], ["bf", "fire"]].forEach(([id, k]) => {
    const el = $(id);
    const on = e => { e.preventDefault(); keys[k] = true; };
    const off = e => { e.preventDefault(); keys[k] = false; };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointerleave", off);
    el.addEventListener("pointercancel", off);
  });

  reset();
  show("SPACE INVADERS", "Press ENTER or tap to start");
  loop();
})();

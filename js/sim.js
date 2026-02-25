// Arcade Space Shooter simulation (Space Invaders / Galaxian-inspired)
(() => {
  const { mulberry32, clamp } = window.SimUtils;

  // Frame config parsed from "Read Me, Commander.pdf" (tiny-spaceships pack)
  // Each sheet has 1px padding between frames (right + bottom).
  const SHIP_SHEETS = {
    tinyShip1:  { w:24, h:27, pad:1, states:["idle","attack","move"] },
    tinyShip2:  { w:34, h:36, pad:1, states:["attack","idle","move"] },
    tinyShip3:  { w:26, h:27, pad:1, states:["move","idle"] },
    tinyShip4:  { w:28, h:23, pad:1, states:["idle","attack","move"] },
    tinyShip5:  { w:34, h:38, pad:1, states:["move","idle"] },
    tinyShip6:  { w:40, h:22, pad:1, states:["idle"] },
    tinyShip7:  { w:46, h:36, pad:1, states:["move","attack","idle"] },
    tinyShip8:  { w:32, h:30, pad:1, states:["idle"] },
    tinyShip9:  { w:34, h:31, pad:1, states:["idle","attack"] },
    tinyShip10: { w:40, h:29, pad:1, states:["idle"] },
    tinyShip11: { w:36, h:28, pad:1, states:["idle","move"] },
    tinyShip12: { w:26, h:27, pad:1, states:["idle"] },
    tinyShip13: { w:24, h:27, pad:1, states:["idle"] },
    tinyShip14: { w:36, h:25, pad:1, states:["move","idle"] },
    tinyShip15: { w:38, h:26, pad:1, states:["idle","attack"] },
    tinyShip16: { w:28, h:28, pad:1, states:["attack","move","idle"] },
    tinyShip17: { w:34, h:25, pad:1, states:["idle","attack"] },
    tinyShip18: { w:32, h:30, pad:1, states:["idle"] },
    tinyShip19: { w:38, h:34, pad:1, states:["move","idle"] },
    tinyShip20: { w:44, h:44, pad:1, states:["move","idle","attack"] },
  };

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  class ShooterSim {
    constructor(w, h, seed) {
      this.w = w;
      this.h = h;
      this.seed = seed >>> 0;
      this.rng = mulberry32(this.seed);

      this.state = "mainmenu"; // "playing" | "paused" | "gameover"

      this.score = 0;
      this.wave = 1;
      this.lives = 3;

      this.player = {
        sheet: "tinyShip3",
        x: (w / 2) - 13,
        y: h - 32,
        vx: 0,
        speed: 1.35,
        cooldown: 0,
        invuln: 0,
        fireAnim: 0,
      };

      this.inv = {
        rows: 5,
        // We compute cols dynamically to fit the viewport (ships are wide).
        colsWanted: 10,
        marginX: 14,
        topY: -165,
        cellW: 40,
        cellH: 34,
        dir: 1,
        speed: 0.18,
        dropY: 10,
        stepClock: 0,
        stepEvery: 10,
      };

      this.invaders = [];
      this.bullets = []; // {x,y,vx,vy,w,h,from}
      this.fx = [];      // {x,y,age,kind}

      this.input = {
        left: false,
        right: false,
        shoot: false,
        shootPressed: false,
      };

      this._tick = 0;
      this._spawnWave();
    }

    getPhase() { return "arcade"; }

    setPlayerSheet(name) {
      if (!SHIP_SHEETS[name]) return;
      this.player.sheet = name;
    }

    _spawnWave() {
      this.invaders.length = 0;
      this.bullets.length = 0;
      this.fx.length = 0;

      // Slightly ramp difficulty
      const speedScale = 1 + (this.wave - 1) * 0.12;
      this.inv.speed = 0.18 * speedScale;
      this.inv.stepEvery = Math.max(5, 10 - (this.wave - 1));
      this.inv.dir = 1;

      // Enemy ship variety by rows (top -> bottom)
      const rowSheets = ["tinyShip1", "tinyShip4", "tinyShip9", "tinyShip15", "tinyShip16"];

      const rows = this.inv.rows;
      const colsWanted = this.inv.colsWanted;
      const cellW = this.inv.cellW;
      const cellH = this.inv.cellH;
      const left = this.inv.marginX;
      const top = this.inv.topY;

      // Fit formation to screen width so it doesn't instantly 'edge hit' and drop every step.
      const maxCols = Math.max(4, Math.floor((this.w - left * 2) / cellW));
      const cols = Math.max(4, Math.min(colsWanted, maxCols));
      this.inv.cols = cols;

      const formationW = cols * cellW;
      const startX = Math.floor((this.w - formationW) / 2);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sheet = rowSheets[r % rowSheets.length];
          const cfg = SHIP_SHEETS[sheet];

          // Center each sprite inside a fixed grid cell.
          const x = startX + c * cellW + Math.floor((cellW - cfg.w) / 2);
          const y = top + r * cellH + Math.floor((cellH - cfg.h) / 2);

          this.invaders.push({
            sheet,
            x,
            y,
            alive: true,
            wobble: (this.rng() * 100) | 0,
          });
        }
      }
    }

    _addExplosion(x, y, kind = "burst") {
      this.fx.push({ x, y, age: 0, kind });
    }

    _playerHit() {
      if (this.player.invuln > 0) return;
      this.lives = Math.max(0, this.lives - 1);
      this.player.invuln = 90; // ticks
      this._addExplosion(this.player.x + 12, this.player.y + 12, "player");
      if (this.lives <= 0) {
        this.state = "gameover";
      }
    }

    _firePlayer() {
      if (this.player.cooldown > 0) return;
      this.player.cooldown = 10;
      this.player.fireAnim = 8;

      // missile sprite size approximated to 8x8 for collision, actual drawn by renderer
      this.bullets.push({
        x: this.player.x + 11,
        y: this.player.y - 4,
        vx: 0,
        vy: -2.4,
        w: 3,
        h: 6,
        from: "player",
      });
    }

    _fireInvader() {
      // Pick a random alive invader near bottom for fairness
      const alive = this.invaders.filter(e => e.alive);
      if (!alive.length) return;
      const e = alive[(this.rng() * alive.length) | 0];
      const cfg = SHIP_SHEETS[e.sheet];
      this.bullets.push({
        x: e.x + (cfg.w * 0.5) - 1,
        y: e.y + cfg.h - 2,
        vx: 0,
        vy: 1.7 + (this.wave * 0.06),
        w: 3,
        h: 6,
        from: "invader",
      });
    }

    step(dtTicks) {
      // dtTicks is always 1 from the engine (fixed step)
      if (this.state !== "playing") {
        // still age FX for nice lingering explosions
        this._stepFx();
        return;
      }

      this._tick++;

      // Player movement
      const p = this.player;
      const cfgP = SHIP_SHEETS[p.sheet];

      let ax = 0;
      if (this.input.left) ax -= 1;
      if (this.input.right) ax += 1;

      p.vx = ax * p.speed;
      p.x += p.vx;

      // clamp to screen
      p.x = clamp(p.x, 2, this.w - cfgP.w - 2);

      // Player shooting
      if (p.cooldown > 0) p.cooldown--;
      if (p.invuln > 0) p.invuln--;
      if (p.fireAnim > 0) p.fireAnim--;

      if (this.input.shootPressed) {
        this._firePlayer();
      }
      this.input.shootPressed = false;

      // Invader formation movement (quantized stepping like classic invaders)
      this.inv.stepClock++;
      if (this.inv.stepClock >= this.inv.stepEvery) {
        this.inv.stepClock = 0;
        this._stepInvaders();
      }

      // Enemy shooting (probability ramps with wave and remaining enemies)
      const aliveCount = this.invaders.reduce((acc, e) => acc + (e.alive ? 1 : 0), 0);
      if (aliveCount > 0) {
        const base = 0.012 + this.wave * 0.002;
        const scarcityBoost = (1 - aliveCount / (this.inv.rows * this.inv.cols)) * 0.020;
        if (this.rng() < (base + scarcityBoost)) {
          this._fireInvader();
        }
      }

      // Bullets
      this._stepBullets(cfgP);

      // FX
      this._stepFx();

      // Wave complete
      if (aliveCount === 0) {
        this.wave++;
        this._spawnWave();
      }
    }

    _stepInvaders() {
      const alive = this.invaders.filter(e => e.alive);
      if (!alive.length) return;

      // compute bounds
      let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const e of alive) {
        const cfg = SHIP_SHEETS[e.sheet];
        minX = Math.min(minX, e.x);
        maxX = Math.max(maxX, e.x + cfg.w);
        maxY = Math.max(maxY, e.y + cfg.h);
      }

      const nextMinX = minX + this.inv.dir * 6;
      const nextMaxX = maxX + this.inv.dir * 6;

      const hitEdge = (nextMinX < 6) || (nextMaxX > this.w - 6);

      if (hitEdge) {
        this.inv.dir *= -1;
        for (const e of alive) e.y += this.inv.dropY;
      } else {
        for (const e of alive) e.x += this.inv.dir * 6;
      }

      // If invaders reach player line: immediate hit loop
      if (maxY > this.player.y - 4) {
        this._playerHit();
      }
    }

    _stepBullets(cfgP) {
      const invAlive = this.invaders;
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // out of bounds
        if (b.y < -20 || b.y > this.h + 20) {
          this.bullets.splice(i, 1);
          continue;
        }

        if (b.from === "player") {
          // collide with invaders
          let hit = false;
          for (const e of invAlive) {
            if (!e.alive) continue;
            const cfg = SHIP_SHEETS[e.sheet];
            if (aabb(b.x, b.y, b.w, b.h, e.x, e.y, cfg.w, cfg.h)) {
              e.alive = false;
              hit = true;
              this.score += 10;
              this._addExplosion(e.x + cfg.w * 0.5, e.y + cfg.h * 0.5, "burst");
              break;
            }
          }
          if (hit) {
            this.bullets.splice(i, 1);
            continue;
          }
        } else {
          // enemy bullet -> player
          if (this.player.invuln <= 0) {
            if (aabb(b.x, b.y, b.w, b.h, this.player.x, this.player.y, cfgP.w, cfgP.h)) {
              this.bullets.splice(i, 1);
              this._playerHit();
              continue;
            }
          }
        }
      }
    }

    _stepFx() {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.age++;
        if (f.age > 28) this.fx.splice(i, 1);
      }
    }
  }

  window.Sim = { ShooterSim, SHIP_SHEETS };
})();

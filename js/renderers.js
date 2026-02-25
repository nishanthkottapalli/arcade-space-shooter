// Rendering for Arcade Space Shooter.
// Keeps the engine contract: exports SheetRenderer and OverlayRenderer.
(() => {
  const { clamp } = window.SimUtils;
  const { SHIP_SHEETS } = window.Sim;

  function computeSheetLayout(imgW, imgH, frameW, frameH, pad) {
    const stepX = frameW + pad;
    const stepY = frameH + pad;
    const cols = Math.max(1, Math.floor((imgW + pad) / stepX));
    const rows = Math.max(1, Math.floor((imgH + pad) / stepY));
    return { cols, rows, stepX, stepY };
  }

  class SpriteBank {
    constructor() {
      this.images = new Map();
      this.meta = new Map();
    }

    loadShip(name) {
      if (this.images.has(name)) return this.images.get(name);
      const img = new Image();
      img.src = `assets/ships/${name}.png`;
      this.images.set(name, img);
      img.onload = () => {
        const cfg = SHIP_SHEETS[name];
        if (!cfg) return;
        const layout = computeSheetLayout(img.naturalWidth, img.naturalHeight, cfg.w, cfg.h, cfg.pad);
        // Map states -> rows by declared order
        const stateRow = {};
        for (let i = 0; i < cfg.states.length; i++) stateRow[cfg.states[i]] = i;
        this.meta.set(name, { cfg, layout, stateRow });
      };
      return img;
    }

    getMeta(name) { return this.meta.get(name) || null; }
  }

  class SheetRenderer {
    constructor(canvas, w, h) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.ctx.imageSmoothingEnabled = false;
      this.w = w; this.h = h;

      this.bank = new SpriteBank();

      // missile icon
      this.missile = new Image();
      this.missile.src = "assets/icons/missile.png";

      // pre-load common sheets
      ["tinyShip3","tinyShip1","tinyShip4","tinyShip9","tinyShip15","tinyShip16"].forEach(n => this.bank.loadShip(n));

      // a soft vignette for readability
      this._vignette = document.createElement("canvas");
      this._vignette.width = w;
      this._vignette.height = h;
      const vctx = this._vignette.getContext("2d");
      const g = vctx.createRadialGradient(w/2, h*0.55, 20, w/2, h*0.55, Math.max(w,h));
      g.addColorStop(0, "rgba(0,0,0,0.0)");
      g.addColorStop(1, "rgba(0,0,0,0.32)");
      vctx.fillStyle = g;
      vctx.fillRect(0, 0, w, h);
    }

    _drawShip(name, x, y, state, frame, alpha = 1) {
      const img = this.bank.loadShip(name);
      const meta = this.bank.getMeta(name);
      if (!meta) {
        // fallback: draw placeholder box
        this.ctx.globalAlpha = alpha;
        this.ctx.strokeStyle = "rgba(255,255,255,0.5)";
        this.ctx.strokeRect(x, y, 10, 10);
        this.ctx.globalAlpha = 1;
        return;
      }

      const { cfg, layout, stateRow } = meta;
      const row = (stateRow[state] !== undefined) ? stateRow[state] : 0;
      const col = frame % layout.cols;

      const sx = col * layout.stepX;
      const sy = row * layout.stepY;

      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(img, sx, sy, cfg.w, cfg.h, x, y, cfg.w, cfg.h);
      this.ctx.globalAlpha = 1;
    }


    _drawShipRot(name, x, y, state, frame, rotRad, alpha = 1) {
      const img = this.bank.loadShip(name);
      const meta = this.bank.getMeta(name);
      if (!meta) {
        this.ctx.globalAlpha = alpha;
        this.ctx.strokeStyle = "rgba(255,255,255,0.5)";
        this.ctx.strokeRect(x, y, 10, 10);
        this.ctx.globalAlpha = 1;
        return;
      }

      const { cfg, layout, stateRow } = meta;
      const row = (stateRow[state] !== undefined) ? stateRow[state] : 0;
      const col = frame % layout.cols;

      const sx = col * layout.stepX;
      const sy = row * layout.stepY;

      const cx = x + cfg.w * 0.5;
      const cy = y + cfg.h * 0.5;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(cx, cy);
      this.ctx.rotate(rotRad);
      this.ctx.drawImage(img, sx, sy, cfg.w, cfg.h, -cfg.w * 0.5, -cfg.h * 0.5, cfg.w, cfg.h);
      this.ctx.restore();
      this.ctx.globalAlpha = 1;
    }

    draw(sim) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);

      // World objects
      // Invaders
      for (const e of sim.invaders) {
        if (!e.alive) continue;
        // simple animation: alternate frames
        const meta = this.bank.getMeta(e.sheet);
        const cols = meta ? meta.layout.cols : 1;
        const f = (Math.floor((sim._tick + e.wobble) / 14) % Math.max(1, cols));
        // TinySpaceships sheets are drawn nose-up; rotate enemies to face down.
        this._drawShipRot(e.sheet, e.x, e.y, "idle", f, Math.PI, 1);
      }

      // Player
      const p = sim.player;
      const moving = Math.abs(p.vx) > 0.01;
      const wantAttack = p.fireAnim > 0;
      const state = wantAttack ? "attack" : (moving ? "move" : "idle");

      // invulnerability blink
      let alpha = 1;
      if (p.invuln > 0) alpha = ((p.invuln >> 2) & 1) ? 0.25 : 1;

      // choose frame
      const pMeta = this.bank.getMeta(p.sheet);
      const pCols = pMeta ? pMeta.layout.cols : 1;
      const pf = Math.floor(sim._tick / 10) % Math.max(1, pCols);
      this._drawShip(p.sheet, p.x, p.y, state, pf, alpha);

      // Bullets
      for (const b of sim.bullets) {
        if (this.missile.complete && this.missile.naturalWidth) {
          // missile icon is bigger; scale down
          const dw = 10, dh = 10;
          ctx.globalAlpha = (b.from === "invader") ? 0.85 : 1;
          ctx.drawImage(this.missile, b.x - 4, b.y - 2, dw, dh);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = (b.from === "invader") ? "rgba(255,120,120,0.9)" : "rgba(255,255,255,0.95)";
          ctx.fillRect(b.x, b.y, b.w, b.h);
        }
      }

      // subtle vignette on top
      ctx.drawImage(this._vignette, 0, 0);
    }
  }

  class OverlayRenderer {
    constructor(canvas, w, h) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.ctx.imageSmoothingEnabled = false;
      this.w = w; this.h = h;

      // FX sheet from your sim (bursts)
      this.fxBursts = new Image();
      this.fxBursts.src = "assets/fx/bursts.png";
      this.fxFrame = { w: 64, h: 64, cols: 13, rows: 9 };

      this.showGrid = false;
      this.showOverlays = true;

      // cached CRT scanline
      this._scan = document.createElement("canvas");
      this._scan.width = w;
      this._scan.height = h;
      const sctx = this._scan.getContext("2d");
      for (let y = 0; y < h; y += 2) {
        sctx.fillStyle = "rgba(0,0,0,0.14)";
        sctx.fillRect(0, y, w, 1);
      }
    }

    setToggles({ showGrid, showOverlays }) {
      if (typeof showGrid === "boolean") this.showGrid = showGrid;
      if (typeof showOverlays === "boolean") this.showOverlays = showOverlays;
    }

    draw(sim) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);

      // Explosions
      const ready = this.fxBursts.complete && this.fxBursts.naturalWidth;
      if (ready) {
        const { w:fw, h:fh, cols } = this.fxFrame;
        for (const f of sim.fx) {
          const frame = Math.min(cols - 1, Math.floor(f.age / 2));
          const row = (f.kind === "player") ? 7 : 5;
          const sx = frame * fw;
          const sy = row * fh;
          const alpha = clamp(1 - (f.age / 28), 0, 1);
          ctx.globalAlpha = alpha;
          // draw centered and scaled down for tiny viewport
          const scale = (f.kind === "player") ? 0.55 : 0.45;
          const dw = fw * scale;
          const dh = fh * scale;
          ctx.drawImage(this.fxBursts, sx, sy, fw, fh, f.x - dw/2, f.y - dh/2, dw, dh);
          ctx.globalAlpha = 1;
        }
      }

      // Title
      if (sim.state === "mainmenu") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, this.w, this.h);

        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = "24px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("SPACE", this.w/2, this.h/2 - 30);
        ctx.fillText("SHOOTER", this.w/2, this.h/2 - 2);
        ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        ctx.fillText("ARCADE", this.w/2, this.h/2 - 60);

        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.font = "12px 'Silkscreen'";
        ctx.fillText("Press Space to start", this.w/2, this.h/2 + 12);
      }

      // Game over text
      if (sim.state === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = "18px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", this.w/2, this.h/2 - 6);
        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.font = "12px 'Silkscreen'";
        ctx.fillText("Press R to restart", this.w/2, this.h/2 + 12);
      }

      // Scanlines on top (arcade vibe)
      if (this.showOverlays) ctx.drawImage(this._scan, 0, 0);
    }
  }

  window.SimRenderers = { SheetRenderer, OverlayRenderer };
})();

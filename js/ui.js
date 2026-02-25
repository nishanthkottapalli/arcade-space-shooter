// Shooter UI: input handling + HUD binding.
(() => {
  class ShooterUI {
    constructor(sim, engine) {
      this.sim = sim;
      this.engine = engine;

      this.root = document.getElementById("gameRoot");
      this._applyAutoScale();
      window.addEventListener("resize", () => this._applyAutoScale());

      // DOM
      this.scorePill = document.getElementById("scorePill");
      this.wavePill = document.getElementById("wavePill");
      this.livesPill = document.getElementById("livesPill");
      this.shipPill = document.getElementById("shipPill");

      this.pauseBtn = document.getElementById("pauseBtn");
      this.restartBtn = document.getElementById("restartBtn");

      // Touch
      this.touchLeft = document.getElementById("touchLeft");
      this.touchShoot = document.getElementById("touchShoot");
      this.touchRight = document.getElementById("touchRight");

      // Keyboard state
      this._bindInputs();
      this._bindButtons();

      this.renderHUD();
    }

    _applyAutoScale() {
      if (!this.root) return;
      const W = 352, H = 198;
      const padW = 24;
      const padH = 120; // footer + margins
      const vw = Math.max(320, window.innerWidth - padW);
      const vh = Math.max(240, window.innerHeight - padH);
      let s = Math.floor(Math.min(vw / W, vh / H));
      if (!Number.isFinite(s) || s < 1) s = 1;
      s = Math.max(1, Math.min(5, s));
      this.root.style.transform = 'scale(' + s + ')';
      this.root.style.transformOrigin = 'center';
    }

    _bindButtons() {
      const togglePause = () => {
        this.engine.setPaused(!this.engine.paused);
        this._syncPauseLabel();
      };
      const restart = () => {
        // easiest: reload without breaking GH pages routing
        const url = new URL(window.location.href);
        url.searchParams.set("seed", String((Math.random() * 0xFFFFFFFF) >>> 0));
        window.location.href = url.toString();
      };

      //const start = restart;

      this.pauseBtn.addEventListener("click", (e) => { e.preventDefault(); togglePause(); });
      this.restartBtn.addEventListener("click", (e) => { e.preventDefault(); restart(); });
      //this.startBtn.addEventListener("click", (e) => { e.preventDefault(); start(); });

      //this._start = start;
      this._restart = restart;
      this._togglePause = togglePause;
    }

    _bindInputs() {
      const sim = this.sim;

      const keyDown = (e) => {
        if (e.repeat) return;
        const k = e.key.toLowerCase();
        if (k === "arrowleft" || k === "a") sim.input.left = true;
        if (k === "arrowright" || k === "d") sim.input.right = true;

        if (k === " " || k === "spacebar") {
          if (sim.state == "mainmenu") {
            sim.state = "playing"
          }
          // shoot on press
          sim.input.shootPressed = true;
          sim.input.shoot = true;
          e.preventDefault();
        }

        if (k === "p") {
          this._togglePause();
        }

        if (k === "r") {
          this._restart();
        }
      };

      const keyUp = (e) => {
        const k = e.key.toLowerCase();
        if (k === "arrowleft" || k === "a") sim.input.left = false;
        if (k === "arrowright" || k === "d") sim.input.right = false;
        if (k === " " || k === "spacebar") sim.input.shoot = false;
      };

      window.addEventListener("keydown", keyDown, { passive: false });
      window.addEventListener("keyup", keyUp);

      // Touch helpers
      const press = (btn, on, off) => {
        const start = (e) => { e.preventDefault(); on(); };
        const end = (e) => { e.preventDefault(); off(); };
        btn.addEventListener("pointerdown", start);
        btn.addEventListener("pointerup", end);
        btn.addEventListener("pointercancel", end);
        btn.addEventListener("pointerleave", end);
      };

      press(this.touchLeft,
        () => { sim.input.left = true; },
        () => { sim.input.left = false; }
      );
      press(this.touchRight,
        () => { sim.input.right = true; },
        () => { sim.input.right = false; }
      );
      press(this.touchShoot,
        () => { sim.input.shootPressed = true; sim.input.shoot = true; },
        () => { sim.input.shoot = false; }
      );
    }

    _syncPauseLabel() {
      this.pauseBtn.textContent = this.engine.paused ? "RESUME" : "PAUSE";
    }

    onTick() {
      // nothing heavy; keep per-tick small
    }

    renderHUD() {
      this.scorePill.textContent = `SCORE: ${this.sim.score}`;
      this.wavePill.textContent = `WAVE: ${this.sim.wave}`;
      this.livesPill.textContent = `LIVES: ${this.sim.lives}`;
      this.shipPill.textContent = `SHIP: ${this.sim.player.sheet}`;
      this._syncPauseLabel();
    }
  }

  window.SimUI = ShooterUI;
})();

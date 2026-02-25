// Engine: fixed-step simulation + render loop
(() => {
  const { nowMs, clamp } = window.SimUtils;
  const { SheetRenderer, OverlayRenderer } = window.SimRenderers;

  class SimEngine {
    constructor(sim, canvas, overlayCanvas) {
      this.sim = sim;
      this.canvas = canvas;
      this.overlayCanvas = overlayCanvas;

      this.renderer = new SheetRenderer(canvas, sim.w, sim.h);
      this.overlay = new OverlayRenderer(overlayCanvas, sim.w, sim.h);

      this.ui = null;

      this.paused = false;
      this.speed = 1;
      this.tickCount = 0;

      this._acc = 0;
      this._last = nowMs();
      this._raf = null;

      // 60Hz fixed step
      this.dt = 1000 / 60;
      this.maxCatchup = 6 * this.dt;
    }

    attachUI(ui) { this.ui = ui; }

    setPaused(p) { this.paused = !!p; }

    setSpeed(mult) { this.speed = clamp(mult, 0.25, 16); }

    setOverlayToggles({ showGrid, showOverlays }) {
      this.overlay.setToggles({ showGrid, showOverlays });
    }

    start() {
      this._last = nowMs();
      const frame = () => {
        const t = nowMs();
        let delta = t - this._last;
        this._last = t;

        // clamp huge gaps (tab switch) to avoid spirals
        delta = Math.min(delta, this.maxCatchup);

        // run fixed steps
        if (!this.paused) {
          this._acc += delta * this.speed;

          while (this._acc >= this.dt) {
            this._acc -= this.dt;
            this.tickCount++;
            // one fixed tick
            this.sim.step(1);
            if (this.ui) this.ui.onTick();
          }
        }

        // render
        this.renderer.draw(this.sim, this.sim.getPhase());
        this.overlay.draw(this.sim);
        if (this.ui) this.ui.renderHUD();

        this._raf = requestAnimationFrame(frame);
      };
      this._raf = requestAnimationFrame(frame);
    }

    stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  window.SimEngine = SimEngine;
})();

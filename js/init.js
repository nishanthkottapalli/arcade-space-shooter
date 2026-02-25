// Bootstraps the arcade shooter.
(() => {
  const { hashStringToSeed } = window.SimUtils;
  const { ShooterSim } = window.Sim;

  function getSeed() {
    const url = new URL(window.location.href);
    const sp = url.searchParams.get("seed");
    if (sp === null || sp === "") {
      const saved = localStorage.getItem("arcade_shooter_seed");
      if (saved) return (parseInt(saved, 10) >>> 0);
      const s = (Math.random() * 0xFFFFFFFF) >>> 0;
      localStorage.setItem("arcade_shooter_seed", String(s));
      return s;
    }
    const n = Number(sp);
    if (!Number.isNaN(n) && Number.isFinite(n)) return (n >>> 0);
    return hashStringToSeed(sp);
  }

  const seed = getSeed();
  const canvas = document.getElementById("gameCanvas");
  const overlayCanvas = document.getElementById("overlayCanvas");

  const sim = new ShooterSim(canvas.width, canvas.height, seed);
  const engine = new window.SimEngine(sim, canvas, overlayCanvas);
  const ui = new window.SimUI(sim, engine);
  engine.attachUI(ui);

  // No lattice/grid overlays for shooter
  engine.setOverlayToggles({ showGrid: false, showOverlays: true });
  engine.setPaused(false);

  engine.start();
})();

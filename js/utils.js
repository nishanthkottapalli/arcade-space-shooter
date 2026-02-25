// Utility helpers
(() => {
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Deterministic PRNG: mulberry32
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStringToSeed(str) {
    // FNV-1a 32-bit
    let h = 0x811C9DC5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // Precompute popcount for bytes
  const POP8 = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let x = i, c = 0;
    while (x) { x &= (x - 1); c++; }
    POP8[i] = c;
  }

  function popcount32(x) {
    // Fast popcount via bytes table
    return POP8[x & 255] + POP8[(x >>> 8) & 255] + POP8[(x >>> 16) & 255] + POP8[(x >>> 24) & 255];
  }

  function nowMs() { return performance && performance.now ? performance.now() : Date.now(); }

  window.SimUtils = { clamp, lerp, mulberry32, hashStringToSeed, popcount32, nowMs };
})();

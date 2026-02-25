// Bitset2D: two-dimensional boolean lattice stored as Uint32Array
(() => {
  const { popcount32 } = window.SimUtils;

  class Bitset2D {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.n = w * h;
      this.words = new Uint32Array((this.n + 31) >>> 5);
    }

    index(x, y) { return y * this.w + x; }

    getByIndex(i) {
      const wi = i >>> 5;
      const bi = i & 31;
      return (this.words[wi] >>> bi) & 1;
    }

    setByIndex(i) {
      const wi = i >>> 5;
      const bi = i & 31;
      this.words[wi] |= (1 << bi);
    }

    clearByIndex(i) {
      const wi = i >>> 5;
      const bi = i & 31;
      this.words[wi] &= ~(1 << bi);
    }

    get(x, y) {
      const i = this.index(x, y);
      return this.getByIndex(i);
    }

    set(x, y) {
      const i = this.index(x, y);
      this.setByIndex(i);
    }

    clear(x, y) {
      const i = this.index(x, y);
      this.clearByIndex(i);
    }

    clearAll() { this.words.fill(0); }

    clone() {
      const b = new Bitset2D(this.w, this.h);
      b.words.set(this.words);
      return b;
    }

    andInto(other, out) {
      const a = this.words, b = other.words, o = out.words;
      for (let i = 0; i < o.length; i++) o[i] = a[i] & b[i];
      return out;
    }

    orInto(other, out) {
      const a = this.words, b = other.words, o = out.words;
      for (let i = 0; i < o.length; i++) o[i] = a[i] | b[i];
      return out;
    }

    xorInto(other, out) {
      const a = this.words, b = other.words, o = out.words;
      for (let i = 0; i < o.length; i++) o[i] = a[i] ^ b[i];
      return out;
    }

    andNotInto(mask, out) {
      const a = this.words, m = mask.words, o = out.words;
      for (let i = 0; i < o.length; i++) o[i] = a[i] & ~m[i];
      return out;
    }

    andNotInPlace(mask) {
      const a = this.words, m = mask.words;
      for (let i = 0; i < a.length; i++) a[i] &= ~m[i];
      return this;
    }

    popcount() {
      let total = 0;
      const a = this.words;
      for (let i = 0; i < a.length; i++) total += popcount32(a[i]);
      return total;
    }

    // Iterate set bits (used sparingly for sampled movement)
    forEachSetBit(cb, maxIters = 1e9) {
      const a = this.words;
      let emitted = 0;
      for (let wi = 0; wi < a.length; wi++) {
        let word = a[wi];
        while (word) {
          const lsb = word & -word;
          const bi = Math.clz32(lsb) ^ 31; // index of bit set (0..31)
          const i = (wi << 5) + bi;
          if (i < this.n) cb(i);
          word ^= lsb;
          emitted++;
          if (emitted >= maxIters) return;
        }
      }
    }
  }

  window.Bitset2D = Bitset2D;
})();

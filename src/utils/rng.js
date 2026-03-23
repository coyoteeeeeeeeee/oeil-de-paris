/**
 * Générateur pseudo-aléatoire déterministe (LCG)
 * Permet de rejouer exactement la même simulation avec le même seed.
 */
export class RNG {
  constructor(seed = Date.now()) {
    this.s = seed >>> 0
  }

  /** Float [0, 1) */
  next() {
    this.s = Math.imul(1664525, this.s) + 1013904223 >>> 0
    return this.s / 0x100000000
  }

  /** Integer [min, max) */
  int(min, max) {
    return Math.floor(this.next() * (max - min)) + min
  }

  /** Gaussian (Box-Muller) */
  gauss(mean = 0, std = 1) {
    const u = this.next() + 1e-9
    const v = this.next()
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}

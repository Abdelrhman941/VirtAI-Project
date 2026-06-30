/**
 * Returns a random floating-point number between lo and hi.
 * @param {number} lo - The lower bound.
 * @param {number} hi - The upper bound.
 * @returns {number}
 */
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * Returns a random integer between lo and hi, inclusive.
 * @param {number} lo - The lower bound.
 * @param {number} hi - The upper bound.
 * @returns {number}
 */
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));

/**
 * Clamps a value between a minimum and maximum value.
 * @param {number} v - The value to clamp.
 * @param {number} lo - The minimum value.
 * @param {number} hi - The maximum value.
 * @returns {number}
 */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Linearly interpolates between a and b by t.
 * @param {number} a - The start value.
 * @param {number} b - The end value.
 * @param {number} t - The interpolation factor (0-1).
 * @returns {number}
 */
export const lerp = (a, b, t) => a + (b - a) * t;

import { clamp01 } from '@ts/geometry'
import { describe, expect, it } from 'vitest'

/**
 * The DOM half of geometry.ts lives in geometry.dom.test.ts; clamp01 needs no
 * document and stays under the node environment.
 */
describe('clamp01', () => {
  it('passes a fraction through untouched', () => {
    expect(clamp01(0.375)).toBe(0.375)
  })

  it('keeps both boundaries', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(1)).toBe(1)
  })

  it('clamps outside the range', () => {
    // A last panel narrower than the leftover viewport overshoots 1; an
    // inverted mirror of the same overshoot goes below 0.
    expect(clamp01(1.4)).toBe(1)
    expect(clamp01(-0.4)).toBe(0)
  })
})

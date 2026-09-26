// @vitest-environment happy-dom

import { onElementorFrontendInit } from '@ts/utils/onElementorFrontendInit'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Elementor rebuilds elementorFrontend.hooks inside every init() and only then
 * dispatches elementor/frontend/init — so a bundle evaluated after that dispatch
 * (an AJAX navigator that runs init() once per page lifetime) must not wait for
 * an event that already happened.
 */

const frontendInit = () => window.dispatchEvent(new Event('elementor/frontend/init'))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('onElementorFrontendInit', () => {
  it('waits for the event while Elementor has not started', () => {
    vi.stubGlobal('elementorFrontend', {})
    const callback = vi.fn()

    onElementorFrontendInit(callback)
    expect(callback).not.toHaveBeenCalled()

    frontendInit()
    expect(callback).toHaveBeenCalledTimes(1)
    window.removeEventListener('elementor/frontend/init', callback)
  })

  it('runs straight away when Elementor has already started', () => {
    vi.stubGlobal('elementorFrontend', { hooks: {} })
    const callback = vi.fn()

    onElementorFrontendInit(callback)

    expect(callback).toHaveBeenCalledTimes(1)
    window.removeEventListener('elementor/frontend/init', callback)
  })

  it('keeps following every later init', () => {
    vi.stubGlobal('elementorFrontend', { hooks: {} })
    const callback = vi.fn()

    onElementorFrontendInit(callback)
    frontendInit()
    frontendInit()

    expect(callback).toHaveBeenCalledTimes(3)
    window.removeEventListener('elementor/frontend/init', callback)
  })

  it('tolerates a page without Elementor', () => {
    vi.stubGlobal('elementorFrontend', undefined)
    const callback = vi.fn()

    expect(() => onElementorFrontendInit(callback)).not.toThrow()
    expect(callback).not.toHaveBeenCalled()
    window.removeEventListener('elementor/frontend/init', callback)
  })
})

import {
  defineDependency,
  editedContainers,
  hasDependencyApi,
  isOurWidget,
  registerDependencies
} from '@ts/editor/patches/dependency'
import { describe, expect, it, vi } from 'vitest'
import { fakeDollarE } from '../../support'

/**
 * The two predicates the editor guards are built on. Both take plain command
 * args, so they are testable without an $e in sight — which is the whole
 * reason they live here rather than inline in each guard. The registration
 * machinery around them (defineDependency, registerDependencies) is Elementor
 * plumbing and is deliberately left to the editor itself.
 */
const container = (widgetType?: string) => ({
  model: { get: (key: string) => (key === 'widgetType' ? widgetType : undefined) }
})

describe('isOurWidget', () => {
  it('recognises our widget', () => {
    expect(isOurWidget(container('arts-horizontal-scroll'))).toBe(true)
  })

  it('rejects any other widget', () => {
    expect(isOurWidget(container('nested-tabs'))).toBe(false)
  })

  it('rejects containers that are not widgets at all', () => {
    expect(isOurWidget(container(undefined))).toBe(false)
  })

  it('is safe on the shapes the command layer actually passes', () => {
    // Guards run against args that may carry no container, no model, or a
    // model that predates the getter — none of which may throw inside a hook.
    expect(isOurWidget(undefined)).toBe(false)
    expect(isOurWidget(null)).toBe(false)
    expect(isOurWidget({})).toBe(false)
    expect(isOurWidget({ model: {} })).toBe(false)
  })
})

describe('editedContainers', () => {
  it('passes a multi-container command through', () => {
    const a = container('a')
    const b = container('b')

    expect(editedContainers({ containers: [a, b] })).toEqual([a, b])
  })

  it('wraps a single-container command', () => {
    const only = container('a')

    expect(editedContainers({ container: only })).toEqual([only])
  })

  it('is empty when the command edits nothing', () => {
    expect(editedContainers({})).toEqual([])
    expect(editedContainers(undefined)).toEqual([])
  })

  it('prefers the plural form when both are present', () => {
    const a = container('a')
    const b = container('b')

    expect(editedContainers({ containers: [a], container: b })).toEqual([a])
  })
})

describe('hasDependencyApi', () => {
  it('is true once both halves of the API are up', () => {
    fakeDollarE()

    expect(hasDependencyApi()).toBe(true)
  })

  it('is false without the Dependency base to extend', () => {
    vi.stubGlobal('$e', { modules: { hookData: {} }, hooks: { registerDataDependency: () => {} } })

    expect(hasDependencyApi()).toBe(false)
  })

  it('is false without a registrar to hand dependencies to', () => {
    vi.stubGlobal('$e', { modules: { hookData: { Dependency: class {} } }, hooks: {} })

    expect(hasDependencyApi()).toBe(false)
  })

  it('is false before $e exists at all', () => {
    vi.stubGlobal('$e', undefined)

    expect(hasDependencyApi()).toBe(false)
  })
})

describe('defineDependency', () => {
  it('wires the command and id onto the instance', () => {
    fakeDollarE()

    const dependency = defineDependency(
      'document/elements/move',
      'an-id',
      () => true,
      () => false
    )

    expect(dependency.getCommand()).toBe('document/elements/move')
    expect(dependency.getId()).toBe('an-id')
  })

  it('hands the command args to both callbacks', () => {
    fakeDollarE()
    const conditions = vi.fn(() => true)
    const apply = vi.fn(() => false)
    const dependency = defineDependency('a/command', 'an-id', conditions, apply)
    const args = { container: {} }

    dependency.getConditions(args)
    dependency.apply(args)

    expect(conditions).toHaveBeenCalledWith(args)
    expect(apply).toHaveBeenCalledWith(args)
  })
})

describe('registerDependencies', () => {
  it('registers everything the thunk yields', () => {
    const { registered } = fakeDollarE()

    registerDependencies('a guard', () => [
      defineDependency(
        'a/one',
        'one',
        () => true,
        () => true
      ),
      defineDependency(
        'a/two',
        'two',
        () => true,
        () => true
      )
    ])

    expect(registered.map((d) => d.getId())).toEqual(['one', 'two'])
  })

  it('never builds anything before the API is there', () => {
    // The thunk is a thunk for exactly this reason: defineDependency extends
    // $e.modules.hookData.Dependency at call time.
    vi.stubGlobal('$e', undefined)
    const make = vi.fn(() => [])

    registerDependencies('a guard', make)

    expect(make).not.toHaveBeenCalled()
  })

  it('contains a failure while building rather than throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fakeDollarE()

    expect(() =>
      registerDependencies('a guard', () => {
        throw new Error('hookData moved')
      })
    ).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('contains a failure while registering', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('$e', {
      modules: { hookData: { Dependency: class {} } },
      hooks: {
        registerDataDependency: () => {
          throw new Error('id already taken')
        }
      }
    })

    expect(() =>
      registerDependencies('a guard', () => [
        defineDependency(
          'a/one',
          'one',
          () => true,
          () => true
        )
      ])
    ).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('names the plugin and the guard in what it logs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fakeDollarE()

    registerDependencies('panel-width guard', () => {
      throw new Error('nope')
    })

    expect(warn.mock.calls[0]?.[0]).toBe(
      '[arts-horizontal-scroll] panel-width guard registration failed:'
    )
  })
})

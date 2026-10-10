// What the engine's measure() last concluded per section, cached for readers
// that run every frame and must never measure themselves (the Motion FX
// override). The engine writes; the Elementor adapter reads and, once
// installed, listens — so the engine itself carries no Elementor coupling.

export interface ITrackState {
  active: boolean
  inverted: boolean
  insetStart: number
  pinWindow: number
}

const states = new WeakMap<HTMLElement, ITrackState>()

let listener: (() => void) | null = null

export const updateTrackState = (wrapper: HTMLElement, state: ITrackState): void => {
  states.set(wrapper, state)
  listener?.()
}

export const readTrackState = (wrapper: HTMLElement): ITrackState | undefined => states.get(wrapper)

export const clearTrackState = (wrapper: HTMLElement): void => {
  states.delete(wrapper)
}

/** One listener, called after every write — the adapter's re-measure nudge. */
export const setTrackStateListener = (callback: (() => void) | null): void => {
  listener = callback
}

/**
 * Realm-safe replacement for `instanceof HTMLElement`. Elementor's editor preview renders in an
 * iframe, so its DOM nodes belong to a different window and `instanceof` against this realm's
 * `HTMLElement` is false for them — always, not only after a re-render. Element nodes report
 * `nodeType === 1` in every realm.
 */
export const isHTMLElement = (subject: unknown): subject is HTMLElement =>
  !!subject && typeof subject === 'object' && (subject as { nodeType?: number }).nodeType === 1

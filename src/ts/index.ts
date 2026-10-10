// Package root: the passive library entry. Importing it installs nothing —
// hosts call createHorizontalScrollApp() and drive init()/mount() themselves.
// The WordPress bundle starts from ./boot instead.

export type { IHorizontalScrollApp, IHorizontalScrollAppOptions } from './app'
export { createHorizontalScrollApp } from './app'
export type * from './contract'

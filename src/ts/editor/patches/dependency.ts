// The $e data-dependency shape, four times over across the two guard modules:
// a Dependency subclass declaring a command, an id, a condition and an apply,
// behind the same availability guard and the same registration try/catch.
// This is lock-panel-moves' own lockRepeaterCommand factory generalized —
// nothing new, one copy.
//
// Mutating command args in a Dependency hook (then returning true) is the
// sanctioned single-transaction path; returning false blocks the command.
import { WIDGET_TYPE } from '../../contract'

/** Both the base class and the registrar are untyped `$e` gaps — see ../globals.d.ts. */
export const hasDependencyApi = (): boolean =>
  typeof $e?.modules?.hookData?.Dependency === 'function' &&
  typeof $e?.hooks?.registerDataDependency === 'function'

export const isOurWidget = (container: any): boolean =>
  WIDGET_TYPE === container?.model?.get?.('widgetType')

/** Single- and multi-container command args, normalized to one list. */
export const editedContainers = (args: any): any[] =>
  args?.containers ?? (args?.container ? [args.container] : [])

export const defineDependency = (
  command: string,
  id: string,
  conditions: (args: any) => boolean,
  onApply: (args: any) => boolean
): any => {
  class Dependency extends $e.modules.hookData.Dependency {
    getCommand(): string {
      return command
    }

    getId(): string {
      return id
    }

    getConditions(args: any): boolean {
      return conditions(args)
    }

    apply(args: any): boolean {
      return onApply(args)
    }
  }

  return new Dependency()
}

// `make` is a thunk on purpose: defineDependency extends
// $e.modules.hookData.Dependency at call time, so nothing may be built before
// hasDependencyApi() has passed.
export const registerDependencies = (label: string, make: () => any[]): void => {
  if (!hasDependencyApi()) {
    return
  }
  try {
    for (const dependency of make()) {
      $e.hooks.registerDataDependency(dependency)
    }
  } catch (e) {
    console.warn(`[${WIDGET_TYPE}] ${label} registration failed:`, e)
  }
}

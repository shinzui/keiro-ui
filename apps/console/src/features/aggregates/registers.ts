export type Registers = Record<string, unknown>

/**
 * The named registers in a state, if it carries them. `state.registers` is the contract of keiro's
 * default snapshot codec and its example's display encoder; a custom codec can use another shape, so
 * anything else is `undefined` and the JSON viewer stays the authority. No field types are assumed.
 */
export function registersOf(state: unknown): Registers | undefined {
  if (typeof state !== "object" || state === null) return undefined
  const { registers } = state as { registers?: unknown }
  if (typeof registers !== "object" || registers === null || Array.isArray(registers))
    return undefined
  return Object.keys(registers).length > 0 ? (registers as Registers) : undefined
}

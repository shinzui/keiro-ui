import { manifests } from "./fixtures"
import { kirokuLog } from "./kiroku-log"
import type { Surface } from "./types"

export interface FeedOptions {
  /** After this many pushed items, drop `dropped` and send the dialect's overflow error. */
  overflowAfter?: number
  /** How many items the script pushes (kiroku events: appends) after the snapshot. */
  append?: number
  /** How many items an overflow drops (appended to the log but never pushed). */
  dropped?: number
  /** Delay between pushes. */
  intervalMs?: number
  /** shibuya only: end the script with a `terminal` frame for the pinned processor. */
  terminal?: "stopped" | "failed"
}

export interface ScenarioState {
  fail: Partial<Record<Surface, string[]>>
  recorded: Partial<Record<Surface, string[]>>
  feeds: Partial<Record<Surface, FeedOptions>>
}

export const scenarioState: ScenarioState = { fail: {}, recorded: {}, feeds: {} }

/**
 * Swaps routes for their recorded error fixture (`fail`) or swaps a derived default for its
 * recorded original (`recorded`). Applies until the mock server or worker is reset.
 */
export function useScenario(scenario: {
  fail?: Partial<Record<Surface, string[]>>
  recorded?: Partial<Record<Surface, string[]>>
}): void {
  if (scenario.fail) Object.assign(scenarioState.fail, scenario.fail)
  if (scenario.recorded) Object.assign(scenarioState.recorded, scenario.recorded)
}

/** Configures the scripted WebSocket feed of a surface for subsequent connections. */
export function feedScript(surface: Surface, options: FeedOptions): void {
  scenarioState.feeds[surface] = { ...scenarioState.feeds[surface], ...options }
}

/** The entity names the manifests recorded fixtures for; tests never hard-code seed names. */
export function pins(surface: Surface): Record<string, string> {
  return { ...manifests[surface].pins }
}

export function resetScenario(): void {
  scenarioState.fail = {}
  scenarioState.recorded = {}
  scenarioState.feeds = {}
  kirokuLog.reset()
}

export { kirokuLog }

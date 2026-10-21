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
  /** keiro only: fields merged into the item every `update` sends as `changed`. */
  changedFields?: Record<string, unknown>
  /** keiro only: the first `update` also removes the snapshot's last item by its key. */
  removeLast?: boolean
}

/**
 * The gated operator actions (plan 19). Unset keeps the recorded behaviour (keiro's health
 * reports mutations disabled; shibuya's control read is the recorded body).
 */
export interface MutationScenario {
  /** keiro's mutation gate: refused, accepting, or refused under schema drift. */
  keiro?: "disabled" | "enabled" | "drift"
  /** The preview disposition of a timer mutation (default: would_requeue / would_cancel). */
  timerDisposition?:
    | "would_requeue"
    | "would_cancel"
    | "not_found"
    | "not_firing"
    | "already_terminal"
  /** A refusal code an executing keiro POST answers with instead of executing. */
  executeRefusal?: "mutation_outcome_unknown" | "command_failed" | "inspection_busy"
  /** A refusal code a keiro preview answers with. */
  previewRefusal?: "inspection_busy" | "origin_not_allowed" | "schema_drift"
  /** shibuya's control gate and the refusal a control POST answers with. */
  shibuyaControl?: "enabled" | "disabled" | "origin_not_allowed"
}

export interface ScenarioState {
  fail: Partial<Record<Surface, string[]>>
  recorded: Partial<Record<Surface, string[]>>
  feeds: Partial<Record<Surface, FeedOptions>>
  mutations: MutationScenario
}

export const scenarioState: ScenarioState = { fail: {}, recorded: {}, feeds: {}, mutations: {} }

/**
 * Swaps routes for their recorded error fixture (`fail`) or swaps a derived default for its
 * recorded original (`recorded`). Applies until the mock server or worker is reset.
 */
export function useScenario(scenario: {
  fail?: Partial<Record<Surface, string[]>>
  recorded?: Partial<Record<Surface, string[]>>
  mutations?: MutationScenario
}): void {
  if (scenario.fail) Object.assign(scenarioState.fail, scenario.fail)
  if (scenario.recorded) Object.assign(scenarioState.recorded, scenario.recorded)
  if (scenario.mutations) Object.assign(scenarioState.mutations, scenario.mutations)
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
  scenarioState.mutations = {}
  kirokuLog.reset()
}

export { kirokuLog }

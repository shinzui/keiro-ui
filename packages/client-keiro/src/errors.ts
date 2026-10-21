import { ApiError, isApiError } from "@keiro-ui/client-core"

/**
 * `/aggregate/*` and `/pm/*` exist only when the host mounts AppHooks. Without them keiro
 * answers 400 `invalid_request` whose `details.arguments` is just the translated argv (for
 * example `["aggregate","types"]`), so the client keys on the command word it sent.
 */
export class RouteUnavailable extends Error {
  readonly word: string
  override readonly cause: ApiError
  constructor(word: string, cause: ApiError) {
    super(`This keiro host does not mount the "${word}" inspection hooks`)
    this.name = "RouteUnavailable"
    this.word = word
    this.cause = cause
  }
}

/** 409 `cursor_generation_mismatch`: the cursor belongs to another read or generation; restart paging. */
export class CursorMismatch extends Error {
  override readonly cause: ApiError
  constructor(cause: ApiError) {
    super(cause.message)
    this.name = "CursorMismatch"
    this.cause = cause
  }
}

export const HOOK_GATED_WORDS = ["aggregate", "pm"] as const

/** Re-throws an ApiError as the typed keiro error it represents, when it is one. */
export function classifyError(error: unknown, word: string): unknown {
  if (!isApiError(error)) return error
  if (
    error.status === 400 &&
    error.code === "invalid_request" &&
    (HOOK_GATED_WORDS as readonly string[]).includes(word)
  ) {
    return new RouteUnavailable(word, error)
  }
  if (error.status === 409 && error.code === "cursor_generation_mismatch")
    return new CursorMismatch(error)
  return error
}

export const isRouteUnavailable = (error: unknown): error is RouteUnavailable =>
  error instanceof RouteUnavailable
export const isCursorMismatch = (error: unknown): error is CursorMismatch =>
  error instanceof CursorMismatch
export const isMutationsDisabled = (error: unknown): boolean =>
  isApiError(error, "mutations_disabled")
export const isSchemaDrift = (error: unknown): boolean => isApiError(error, "schema_drift")
export const isInspectionBusy = (error: unknown): boolean => isApiError(error, "inspection_busy")
export const isTooLarge = (error: unknown): boolean =>
  isApiError(error) &&
  error.status === 413 &&
  (error.code === "inspection_request_too_large" || error.code === "inspection_result_too_large")

export { ApiError }

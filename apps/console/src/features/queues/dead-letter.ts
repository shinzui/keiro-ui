// shibuya-pgmq-adapter writes a dead letter as a JSON object with four always-present fields —
// original_message, dead_letter_reason (legacy rendered text), dead_letter_reason_code (a dotted
// code), dead_letter_reason_detail (structured, possibly null) — and, when the application
// enabled includeMetadata, original_message_id, original_enqueued_at, last_read_at, read_count,
// and original_headers (the adapter's IR-1 contract in mori://shinzui/shibuya-pgmq-adapter).
// There is no original-queue field.

export interface DeadLetterPayload {
  originalMessage: unknown
  reason: string
  reasonCode: string
  reasonDetail: unknown
  originalMessageId?: bigint | number
  originalEnqueuedAt?: string
  lastReadAt?: string
  readCount?: bigint | number
  originalHeaders?: unknown
}

const REQUIRED = [
  "original_message",
  "dead_letter_reason",
  "dead_letter_reason_code",
  "dead_letter_reason_detail",
] as const

const integer = (value: unknown) =>
  typeof value === "number" || typeof value === "bigint" ? value : undefined
const text = (value: unknown) => (typeof value === "string" ? value : undefined)

/** The adapter's dead-letter fields when `message` carries all four required ones, else null. */
export function detectDeadLetter(message: unknown): DeadLetterPayload | null {
  if (typeof message !== "object" || message === null || Array.isArray(message)) return null
  const m = message as Record<string, unknown>
  if (!REQUIRED.every((field) => field in m)) return null
  const reason = text(m.dead_letter_reason)
  const reasonCode = text(m.dead_letter_reason_code)
  if (reason === undefined || reasonCode === undefined) return null
  return {
    originalMessage: m.original_message,
    reason,
    reasonCode,
    reasonDetail: m.dead_letter_reason_detail,
    originalMessageId: integer(m.original_message_id),
    originalEnqueuedAt: text(m.original_enqueued_at),
    lastReadAt: text(m.last_read_at),
    readCount: integer(m.read_count),
    originalHeaders: m.original_headers,
  }
}

export const REDRIVE_UNAVAILABLE =
  "Redrive is not available: shibuya-pgmq-adapter has not shipped a dead-letter redrive endpoint (IR-3 is proposed)."

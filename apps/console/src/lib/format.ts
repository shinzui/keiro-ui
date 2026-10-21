// Every timestamp, duration, count, and position distance on screen is formatted here.
// Vocabulary rule (MasterPlan): keiro-facing screens call a head-versus-position
// difference the "global position distance" and never use queueing words for it.

const THIN_SPACE = " "

function pad2(value: number): string {
  return value.toString().padStart(2, "0")
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

/** "3 s ago", "in 2 min", "yesterday", "5 d ago"; older than 30 days shows the date. */
export function formatRelativeTime(iso: string | Date, now: Date = new Date()): string {
  const date = toDate(iso)
  if (Number.isNaN(date.getTime())) return "unknown time"
  const deltaSeconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const future = deltaSeconds > 0
  const seconds = Math.abs(deltaSeconds)
  const phrase = (amount: string) => (future ? `in ${amount}` : `${amount} ago`)
  if (seconds < 1) return "just now"
  if (seconds < 60) return phrase(`${seconds} s`)
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return phrase(`${minutes} min`)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return phrase(`${hours} h`)
  const days = Math.floor(hours / 24)
  if (days === 1) return future ? "tomorrow" : "yesterday"
  if (days < 30) return phrase(`${days} d`)
  return date.toISOString().slice(0, 10)
}

/** "840 ms", "3.2 s", "4 min 12 s", "2 h 05 min", "3 d 04 h". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—"
  const sign = seconds < 0 ? "−" : ""
  const s = Math.abs(seconds)
  if (s < 1) return `${sign}${Math.round(s * 1000)} ms`
  if (s < 10) return `${sign}${s.toFixed(1)} s`
  if (s < 60) return `${sign}${Math.floor(s)} s`
  const totalSeconds = Math.floor(s)
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${sign}${minutes} min ${totalSeconds % 60} s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${sign}${hours} h ${pad2(minutes % 60)} min`
  const days = Math.floor(hours / 24)
  return `${sign}${days} d ${pad2(hours % 24)} h`
}

/** `absolute` is ISO 8601 in UTC; `relative` is `formatRelativeTime`. */
export function formatTimestamp(
  iso: string | Date,
  now?: Date,
): { absolute: string; relative: string } {
  const date = toDate(iso)
  if (Number.isNaN(date.getTime())) return { absolute: String(iso), relative: "unknown time" }
  return { absolute: date.toISOString(), relative: formatRelativeTime(date, now) }
}

/** Groups digits with thin spaces (U+2009): "1 234 567". Exact for bigint. */
export function formatInt(value: bigint | number): string {
  const text = typeof value === "bigint" ? value.toString() : Math.trunc(value).toString()
  const negative = text.startsWith("-")
  const digits = negative ? text.slice(1) : text
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE)
  return negative ? `−${grouped}` : grouped
}

const BYTE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "—"
  let value = Math.abs(bytes)
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const text = unit === 0 ? value.toString() : value.toFixed(value < 10 ? 1 : 0)
  return `${bytes < 0 ? "−" : ""}${text} ${BYTE_UNITS[unit]}`
}

export const POSITION_DISTANCE_LABEL = "global position distance"

/** distance = visible store head − position. */
export function formatPositionDistance(
  visibleStoreHead: bigint,
  position: bigint,
): { distance: bigint; text: string } {
  const distance = visibleStoreHead - position
  if (distance === 0n) return { distance, text: "at visible store head" }
  if (distance < 0n) return { distance, text: `${formatInt(-distance)} beyond visible store head` }
  return { distance, text: `${formatInt(distance)} behind visible store head` }
}

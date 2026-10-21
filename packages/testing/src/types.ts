export const surfaces = ["kiroku", "pgmq", "shibuya", "keiro"] as const
export type Surface = (typeof surfaces)[number]

export interface ManifestEntry {
  slug: string
  /** Path template relative to the surface root, with `{pin}` placeholders. */
  path: string
  query?: Record<string, string>
  method?: "GET" | "POST"
  /** `error` records `<slug>.error.json`. */
  variant?: "error"
  /** Placeholder values that override the pins for this entry (error requests). */
  params?: Record<string, string>
  /** Record the page at the first page's `next_cursor` as `<slug>.page2.json`. */
  follow_next_cursor?: boolean
  /** Pins this entry needs; it is skipped when they cannot be resolved. */
  needs?: string[]
}

export interface Manifest {
  surface: Surface
  /** The path prefix the console reaches the surface under (`/kiroku`, ...). */
  prefix: string
  port_env: string
  /** The query parameter that carries a page cursor (`from` or `after`). */
  cursor_param: string
  /** Entity names fixtures were recorded for; tests read them through `pins(surface)`. */
  pins: Record<string, string>
  entries: ManifestEntry[]
}

export interface FileMeta {
  surface: Surface
  slug: string
  variant: "default" | "error" | "page2" | "recorded"
  method: string
  template: string
  query: Record<string, string>
  params: Record<string, string>
  request: string
  status: number
  contentType: string
  /** For `page2`: the cursor of the first page that leads here. */
  cursor?: string
  derived?: boolean
  derived_from?: string
}

export interface MetaFile {
  recorded_at: string
  seed: string
  sources: Record<string, { commit: string }>
  files: Record<string, FileMeta>
}

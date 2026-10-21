import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export interface ThemeState {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "keiro-ui.theme.v1"
const DARK_QUERY = "(prefers-color-scheme: dark)"

const ThemeContext = createContext<ThemeState | null>(null)

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") return stored
  } catch {
    // Storage may be unavailable (private mode, blocked site data); fall back to the default.
  }
  return "light"
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches
}

function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {}
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function ignoreSystemTheme(): () => void {
  return () => {}
}

/**
 * The console is light by default. It follows the operating-system preference only when the
 * operator explicitly picks `system`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  // The operating-system preference is only listened to while the operator chose `system`.
  const systemDark = useSyncExternalStore(
    theme === "system" ? subscribeToSystemTheme : ignoreSystemTheme,
    systemPrefersDark,
    () => false,
  )

  const resolved: ResolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark")
  }, [resolved])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Persisting is a convenience; the in-memory choice still applies.
    }
  }, [])

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext)
  if (!state) throw new Error("useTheme must be used inside <ThemeProvider>")
  return state
}

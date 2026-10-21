import { queryKeys } from "@keiro-ui/client-core"

/** shibuya's query keys; every key starts with "shibuya". */
export const shibuyaKeys = {
  all: () => queryKeys.shibuya(),
  processors: () => queryKeys.shibuya("processors"),
  processor: (id: string) => queryKeys.shibuya("processor", id),
  health: (kind: "live" | "ready" | "combined") => queryKeys.shibuya("health", kind),
  control: () => queryKeys.shibuya("control"),
}

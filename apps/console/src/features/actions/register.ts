import { registerFeature } from "@/shell/features"

import { SessionAuditSheet } from "./session-audit-sheet"

/** The operator actions' shell contributions: the session audit sheet. */
export function registerActionsFeature(): void {
  registerFeature({ id: "actions", sheets: { actions: SessionAuditSheet } })
}

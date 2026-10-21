// Opaque base64url cursors bound to one read kind (and, for journals and steps, one
// generation). The console never inspects or constructs them; the brands stop a cursor from
// one read being echoed into another at compile time.
declare const brand: unique symbol
type Cursor<K extends string> = string & { readonly [brand]: K }

export type WorkflowListCursor = Cursor<"workflow-list">
export type JournalCursor = Cursor<"journal">
export type StepsCursor = Cursor<"steps">
export type ChildrenCursor = Cursor<"children">
export type AwakeablesCursor = Cursor<"awakeables">
export type AggregateListCursor = Cursor<"aggregate-list">
export type ProcessManagerListCursor = Cursor<"process-manager-list">
export type TimerCursor = Cursor<"timer">
export type ProjectionStatusCursor = Cursor<"projection-status">

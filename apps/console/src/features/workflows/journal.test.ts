import type { WorkflowJournalEntry } from "@keiro-ui/client-keiro"
import { expect, test } from "vitest"

import { groupBySteps, journalEntryRef, lensIndices, parseJournalEntryRef } from "./journal"

const entry = (step_name: string, event_type = "StepRecorded") =>
  ({ step_name, event_type }) as WorkflowJournalEntry

const journal = [
  entry("reserve"),
  entry("charge"),
  entry("charge"),
  entry("ship"),
  entry("__workflow_failed__", "WorkflowFailed"),
]

test("lenses: steps hides synthetic entries, errors keeps failures and their predecessors", () => {
  expect(lensIndices(journal, "all")).toEqual([0, 1, 2, 3, 4])
  expect(lensIndices(journal, "steps")).toEqual([0, 1, 2, 3])
  expect(lensIndices(journal, "errors")).toEqual([3, 4])
})

test("consecutive entries of one step form a group; a filtered gap splits groups", () => {
  expect(groupBySteps(journal, [0, 1, 2, 3]).map((g) => [g.step, g.indices.length])).toEqual([
    ["reserve", 1],
    ["charge", 2],
    ["ship", 1],
  ])
})

test("sheet references keep ids containing slashes", () => {
  const ref = journalEntryRef("order-fulfillment", "id/1", "d02277f7-d289-55ac-bbc4-4ad6e3c591aa")
  expect(parseJournalEntryRef(ref)).toEqual({
    name: "order-fulfillment",
    id: "id/1",
    eventId: "d02277f7-d289-55ac-bbc4-4ad6e3c591aa",
  })
})

import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { detectDeadLetter, REDRIVE_UNAVAILABLE } from "./dead-letter"
import { DeadLetterPanel } from "./dead-letter-panel"

const adapterPayload = {
  original_message: { order_id: "ord-9", total: -1 },
  dead_letter_reason: 'PoisonMessage "total must be positive"',
  dead_letter_reason_code: "poison_message",
  dead_letter_reason_detail: { field: "total", rule: "positive" },
  read_count: 5,
}

test("a payload with the adapter's four fields renders the panel with redrive unavailable", () => {
  const deadLetter = detectDeadLetter(adapterPayload)
  expect(deadLetter).not.toBeNull()
  render(<DeadLetterPanel deadLetter={deadLetter!} />)
  const panel = screen.getByRole("region", { name: "Dead letter" })
  expect(panel).toHaveTextContent("poison_message")
  expect(panel).toHaveTextContent("Attempts5")
  expect(panel).toHaveTextContent(/^.*Redrive is not available/)
  expect(screen.getByText(REDRIVE_UNAVAILABLE)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /redrive/i })).toBeNull()
})

test("payloads without all four adapter fields are not dead letters", () => {
  expect(detectDeadLetter({ order_id: "ord-1", total: 42 })).toBeNull()
  const { dead_letter_reason_detail: _detail, ...missingOne } = adapterPayload
  expect(detectDeadLetter(missingOne)).toBeNull()
  expect(detectDeadLetter([adapterPayload])).toBeNull()
  expect(detectDeadLetter(null)).toBeNull()
})

test("optional metadata reads as not recorded and a null detail as none", () => {
  const deadLetter = detectDeadLetter({
    ...adapterPayload,
    read_count: undefined,
    dead_letter_reason_detail: null,
  })
  render(<DeadLetterPanel deadLetter={deadLetter!} />)
  const panel = screen.getByRole("region", { name: "Dead letter" })
  expect(panel).toHaveTextContent("Attemptsnot recorded")
  expect(panel).toHaveTextContent("Detailnone")
})

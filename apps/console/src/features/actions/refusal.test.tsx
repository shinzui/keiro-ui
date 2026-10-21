import { ApiError } from "@keiro-ui/client-core"
import { MutationOutcomeUnknown, SchemaDrift } from "@keiro-ui/client-keiro/mutations"
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { RefusalView } from "./refusal"

const keiro = (status: number, code: string, message: string, details?: unknown) =>
  new ApiError({ surface: "keiro", status, code, message, details, raw: null })
const shibuya = (status: number, code: string, message: string, details?: unknown) =>
  new ApiError({ surface: "shibuya", status, code, message, details, raw: null })

describe("every refusal renders its code and the server's message verbatim", () => {
  test.each([
    [
      keiro(403, "mutations_disabled", "this surface was mounted without mutations"),
      "start keiro-ops-http with --enable-mutations",
    ],
    [
      keiro(400, "invalid_confirmation", 'expected an empty body or exactly {"confirm":"execute"}'),
      null,
    ],
    [keiro(422, "command_failed", "TimerStoreError"), null],
    [keiro(503, "inspection_busy", "all inspection slots are in use; retry later"), null],
    [keiro(403, "origin_not_allowed", "origin not allowed"), "preserve Host"],
    [keiro(415, "unsupported_media_type", "expected JSON"), null],
    [keiro(413, "inspection_request_too_large", "confirmation body over 1 KiB"), null],
    [shibuya(403, "control_disabled", "Control operations are disabled"), "enableControl = False"],
    [shibuya(403, "origin_not_allowed", "Origin not allowed"), "corsAllowedOrigins"],
    [shibuya(404, "processor_not_found", "Processor not found", { processor: "x" }), "processor x"],
    [
      shibuya(409, "processor_not_controllable", "Processor is not controllable", {
        processor: "x",
      }),
      null,
    ],
    [shibuya(409, "processor_terminal", "Processor has terminated", { processor: "x" }), null],
    [shibuya(409, "processor_draining", "Processor is draining", { processor: "x" }), null],
    [shibuya(405, "method_not_allowed", "Method not allowed"), null],
  ])("%s", (error, meaning) => {
    render(<RefusalView error={error} />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveAttribute("data-refusal", error.code)
    expect(alert).toHaveTextContent(error.code)
    expect(alert).toHaveTextContent(error.message)
    if (meaning) expect(alert).toHaveTextContent(meaning)
  })
})

test("a typed refusal shows its ApiError, a drift list, and the unknown-outcome advice", () => {
  const drift = new SchemaDrift(
    keiro(409, "schema_drift", "the live schema drifts from the binary", {
      drift: ["keiro_timers.attempts"],
    }),
  )
  const { unmount } = render(<RefusalView error={drift} />)
  expect(screen.getByRole("list", { name: "Schema drift" })).toHaveTextContent(
    "keiro_timers.attempts",
  )
  unmount()
  render(
    <RefusalView
      error={new MutationOutcomeUnknown(keiro(504, "mutation_outcome_unknown", "deadline passed"))}
    />,
  )
  expect(screen.getByRole("alert")).toHaveTextContent("The outcome is unknown")
})

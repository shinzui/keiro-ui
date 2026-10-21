import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"
import { z } from "zod"

import { createHttpClient } from "../src/http"
import { int64, parseJsonLossless, serializeJson } from "../src/int64"
import { pageSchema } from "../src/pages"

// Every recorded response (packages/testing/fixtures, owned by
// docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md) parses losslessly,
// and every page parses through the generic page schema. Without the fixtures, the inline
// samples stand in.

const fixturesRoot = join(import.meta.dirname, "../../testing/fixtures")
const samplesRoot = join(import.meta.dirname, "samples")

interface Sample {
  name: string
  text: string
}

function loadSamples(): Sample[] {
  if (!existsSync(fixturesRoot)) {
    return readdirSync(samplesRoot).map((name) => ({
      name,
      text: readFileSync(join(samplesRoot, name), "utf8"),
    }))
  }
  const meta = JSON.parse(readFileSync(join(fixturesRoot, "_meta.json"), "utf8")) as {
    files: Record<string, { contentType: string }>
  }
  return Object.entries(meta.files)
    .filter(([, entry]) => entry.contentType.includes("json"))
    .map(([name]) => ({ name, text: readFileSync(join(fixturesRoot, name), "utf8") }))
}

const genericPage = pageSchema(z.unknown(), z.union([z.string(), int64()]))
const samples = loadSamples()

describe("recorded responses", () => {
  test("there are samples to check", () => {
    expect(samples.length).toBeGreaterThan(10)
  })

  test.each(samples.map((s) => [s.name, s] as const))("%s parses losslessly", (_name, sample) => {
    const value = parseJsonLossless(sample.text)
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Array.isArray((value as { items?: unknown }).items)
    ) {
      expect(genericPage.safeParse(value).success).toBe(true)
    }
  })

  test("every integer in a pgmq message page re-serializes to its exact digits", () => {
    const sample = samples.find(
      (s) => s.name.endsWith("queue-message-big-id.json") || s.name === "pgmq-messages-page.json",
    )!
    expect(serializeJson(parseJsonLossless(sample.text))).toBe(sample.text.trim())
  })
})

// MasterPlan early check 1: through the Vite proxy against the local stack.
//   KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-core test -- test/contract.test.ts
const live = process.env.KEIRO_UI_LIVE === "1"
const liveBase = process.env.KEIRO_UI_LIVE_BASE ?? "http://localhost:5173"

describe.runIf(live)("live stack through the dev proxy", () => {
  test("kiroku /capabilities", async () => {
    const kiroku = createHttpClient({ surface: "kiroku", baseUrl: `${liveBase}/kiroku` })
    const capabilities = (await kiroku.get("/capabilities")) as {
      package: string
      version?: string
    }
    console.log(`kiroku ${capabilities.package} ${capabilities.version ?? "(no version field)"}`)
    expect(capabilities.package).toBe("kiroku-metrics")
  })

  test("pgmq message ids round-trip exactly", async () => {
    const base = `${liveBase}/pgmq`
    const pgmq = createHttpClient({ surface: "pgmq", baseUrl: base })
    const queues = (await pgmq.get("/queues")) as { queue_name: string }[]
    expect(
      queues.length,
      "no queues: seed them with docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md (just stack-up)",
    ).toBeGreaterThan(0)
    let compared = 0
    for (const { queue_name: queue } of queues) {
      const path = `/queues/${encodeURIComponent(queue)}/messages?limit=50`
      const raw = await (await fetch(`${base}${path}`)).text()
      const page = (await pgmq.get(`/queues/${encodeURIComponent(queue)}/messages`, {
        query: { limit: 50 },
      })) as {
        items: { msg_id: bigint | number }[]
      }
      for (const item of page.items) {
        const digits = String(item.msg_id)
        expect(raw).toContain(`"msg_id":${digits}`)
        if (typeof item.msg_id === "bigint")
          console.log(`pgmq ${queue} msg_id ${digits} (bigint, exact)`)
        compared += 1
      }
    }
    console.log(`compared ${compared} msg_id values`)
    expect(compared).toBeGreaterThan(0)
  })
})

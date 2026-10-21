import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { fixtureMeta, manifests } from "../src/fixtures"
import { surfaces } from "../src/types"

const root = join(import.meta.dirname, "../fixtures")

function filesOf(surface: string): string[] {
  return readdirSync(join(root, surface)).map((f) => `${surface}/${f}`)
}

describe.each(surfaces)("%s fixtures", (surface) => {
  const files = filesOf(surface)

  test("every JSON fixture parses", () => {
    for (const file of files) {
      const meta = fixtureMeta.files[file]
      if (meta && !meta.contentType.includes("json")) continue
      expect(() => JSON.parse(readFileSync(join(root, file), "utf8")), file).not.toThrow()
    }
  })

  test("_meta.json lists every file and every listed file exists", () => {
    const listed = Object.keys(fixtureMeta.files).filter((f) => f.startsWith(`${surface}/`))
    expect(listed.toSorted()).toEqual(files.toSorted())
  })

  test("every manifest slug has a fixture unless its pins are unresolved", () => {
    for (const entry of manifests[surface].entries) {
      const name = entry.variant ? `${entry.slug}.${entry.variant}.json` : `${entry.slug}.json`
      const unresolved = (entry.needs ?? []).some((pin) => !manifests[surface].pins[pin])
      if (unresolved) continue
      expect(files, name).toContain(`${surface}/${name}`)
    }
  })
})

test("the pgmq message id above 2^53 is stored byte for byte", () => {
  const body = readFileSync(join(root, "pgmq/queue-message-big-id.json"), "utf8")
  expect(body).toContain('"msg_id":9007199254740994')
})

test("_meta.json names the source commits and the seed", () => {
  expect(Object.keys(fixtureMeta.sources)).toEqual(
    expect.arrayContaining(["kiroku", "pgmq-hs", "shibuya", "keiro"]),
  )
  expect(fixtureMeta.seed).toMatch(/jitsurei-all/)
  expect(Object.values(fixtureMeta.files).some((f) => f.variant === "page2")).toBe(true)
})

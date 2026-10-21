import { readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"
import type { z } from "zod"

import { componentMirrors } from "../src/schemas"

const document = JSON.parse(
  readFileSync(join(import.meta.dirname, "../openapi/pgmq-inspect.openapi.json"), "utf8"),
) as {
  components: {
    schemas: Record<string, { required?: string[]; properties?: Record<string, unknown> }>
  }
}

test.each(Object.entries(componentMirrors))("%s mirrors its OpenAPI component", (name, schema) => {
  const component = document.components.schemas[name]
  expect(component, `no component ${name}`).toBeDefined()
  const keys = Object.keys((schema as unknown as z.ZodObject<z.ZodRawShape>).shape)
  for (const required of component!.required ?? [])
    expect(keys, `${name}.${required}`).toContain(required)
  for (const key of keys)
    expect(Object.keys(component!.properties ?? {}), `${name}.${key}`).toContain(key)
})

// Prints health and the first workflows page (bun run --filter @keiro-ui/client-keiro smoke).
import { stackOrigin } from "@keiro-ui/testing/stack"

import { createKeiroClient } from "../src/client"

const keiro = createKeiroClient({ baseUrl: process.env.KEIRO_URL ?? stackOrigin("keiro") })
console.log(await keiro.health.get())
for (const workflow of (await keiro.workflows.list({ limit: 20 })).items) {
  console.log(`${workflow.workflow_name}/${workflow.workflow_id} ${workflow.status_class}`)
}

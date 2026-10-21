// Prints health and the first workflows page (bun run --filter @keiro-ui/client-keiro smoke).
import { createKeiroClient } from "../src/client"

const keiro = createKeiroClient({ baseUrl: process.env.KEIRO_URL ?? "http://127.0.0.1:9093" })
console.log(await keiro.health.get())
for (const workflow of (await keiro.workflows.list({ limit: 20 })).items) {
  console.log(`${workflow.workflow_name}/${workflow.workflow_id} ${workflow.status_class}`)
}

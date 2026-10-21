// Prints each processor's state and counters (bun run --filter @keiro-ui/client-shibuya smoke).
import { createShibuyaClient } from "../src/client"

const shibuya = createShibuyaClient({ baseUrl: process.env.SHIBUYA_URL ?? "http://127.0.0.1:9090" })
for (const [id, record] of Object.entries(await shibuya.metrics.all())) {
  console.log(
    `${id}: ${record.state.status} received=${record.stats.received} processed=${record.stats.processed} failed=${record.stats.failed}`,
  )
}

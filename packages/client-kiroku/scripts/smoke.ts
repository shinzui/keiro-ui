// Prints the live /capabilities document and the store head (bun run --filter @keiro-ui/client-kiroku smoke).
import { createKirokuClient } from "../src/client"

const kiroku = createKirokuClient({ baseUrl: process.env.KIROKU_URL ?? "http://127.0.0.1:9091" })
console.log(JSON.stringify(await kiroku.capabilities(), null, 2))
const inventory = await kiroku.checkpoints.inventory()
console.log(
  `store head (store_position): ${inventory.store_position}; ${inventory.checkpoints.length} checkpoints`,
)

import { rmSync } from "node:fs"
import { basename } from "node:path"
export default function teardown() {
  const directory = process.env.MULTI_APP_CONFIG_DIR
  if (
    process.env.MULTI_APP_OWNS_CONFIG === "1" &&
    directory &&
    basename(directory).startsWith("keiro-ui-multi-app-")
  )
    rmSync(directory, { recursive: true, force: true })
}

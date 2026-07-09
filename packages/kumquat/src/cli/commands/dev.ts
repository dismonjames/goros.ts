import { startDevServer } from "../../dev/dev-server"
import type { ResolvedKumquatConfig } from "../../config/types"

export async function devCommand(root: string, runtimeOverride?: ResolvedKumquatConfig["runtime"]): Promise<void> {
  await startDevServer(root, runtimeOverride)
}

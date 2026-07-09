import { build } from "../../build/build"
import type { ResolvedKumquatConfig } from "../../config/types"

export async function buildCommand(root: string, runtimeOverride?: ResolvedKumquatConfig["runtime"]): Promise<void> {
  await build(root, runtimeOverride)
}

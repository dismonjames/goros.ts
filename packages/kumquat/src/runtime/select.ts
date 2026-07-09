import type { ResolvedKumquatConfig } from "../config/types"
import { bunRuntime } from "./bun"
import { denoRuntime } from "./deno"
import { nodeRuntime } from "./node"
import type { RuntimeServer } from "./types"

export function selectRuntime(runtime: ResolvedKumquatConfig["runtime"]): RuntimeServer {
  if (runtime === "bun") return bunRuntime
  if (runtime === "node") return nodeRuntime
  return denoRuntime
}

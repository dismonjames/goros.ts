import path from "node:path"
import { scanRoutes } from "../scanner/scan-routes"
import { loadConfig } from "../config/load-config"
import { resolvePath } from "../utils/path"
import type { ResolvedBoronixConfig } from "../config/types"
import type { RouteManifest } from "../scanner/route-manifest"
import type { DevChangeKind, DevFileChange, DevReloadEvent, ReloadResult } from "./types"
import type { ReloadChannel } from "./reload-channel"
import { classifyChange } from "./change-classifier"

export type ReloaderOptions = {
  root: string
  config: ResolvedBoronixConfig
  manifest: RouteManifest
  channel: ReloadChannel
  debug: boolean
  quiet: boolean
  runtimeOverride?: ResolvedBoronixConfig["runtime"] | undefined
  portOverride?: number | undefined
  hostOverride?: string | undefined
  onReload: (manifest: RouteManifest, config: ResolvedBoronixConfig, revision: number) => void
}

export type Reloader = {
  handleChanges(changes: DevFileChange[]): Promise<void>
  getRevision(): number
  getManifest(): RouteManifest
  getConfig(): ResolvedBoronixConfig
  setLastError(error: unknown): void
  clearLastError(): void
  hasError(): boolean
}

export function createReloader(options: ReloaderOptions): Reloader {
  let revision = 1
  let manifest = options.manifest
  let config = options.config
  let lastError: unknown = null

  function classifyAll(changes: DevFileChange[]): DevFileChange[] {
    return changes.map((c) => {
      if (c.kind !== "unknown") return c
      return classifyChange(c.absolutePath, options.root, c.event)
    })
  }

  function determineBatchKind(changes: DevFileChange[]): DevChangeKind {
    const kinds = new Set(changes.filter(c => c.kind !== "unknown").map(c => c.kind))
    if (kinds.has("config")) return "config"
    if (kinds.has("env")) return "env"
    if (kinds.has("route-structure")) return "route-structure"
    if (kinds.has("shared-module")) return "shared-module"
    if (kinds.has("route-module")) return "route-module"
    if (kinds.has("template")) return "template"
    if (kinds.has("public-asset")) return "public-asset"
    return "unknown"
  }

  async function handleChanges(rawChanges: DevFileChange[]): Promise<void> {
    const changes = classifyAll(rawChanges)
    const batchKind = determineBatchKind(changes)

    if (batchKind === "unknown") {
      return
    }

    const startTime = performance.now()

    let ok = true
    let routesRescanned = false
    let error: unknown = undefined

    try {
      if (batchKind === "config" || batchKind === "env") {
        const newConfig = await loadConfig(options.root)
        if (options.runtimeOverride) {
          newConfig.runtime = options.runtimeOverride
        }
        if (options.portOverride !== undefined) {
          newConfig.server.port = options.portOverride
        }
        if (options.hostOverride !== undefined) {
          newConfig.server.host = options.hostOverride
        }
        const newManifest = scanRoutes(resolvePath(options.root, newConfig.app.routesDir))
        config = newConfig
        manifest = newManifest
        routesRescanned = true
      } else if (batchKind === "route-structure") {
        manifest = scanRoutes(resolvePath(options.root, config.app.routesDir))
        routesRescanned = true
      } else if (batchKind === "shared-module") {
        manifest = scanRoutes(resolvePath(options.root, config.app.routesDir))
        routesRescanned = true
      } else if (batchKind === "route-module") {
        const routeChanges = changes.filter(c => c.kind === "route-module")
        for (const change of routeChanges) {
          if (change.event === "create" || change.event === "remove") {
            manifest = scanRoutes(resolvePath(options.root, config.app.routesDir))
            routesRescanned = true
            break
          }
        }
      }
      // template and public-asset changes don't need manifest/config update

      if (ok) {
        revision += 1
        lastError = null
        options.onReload(manifest, config, revision)
      }
    } catch (err) {
      ok = false
      error = err
      lastError = err
    }

    const durationMs = Math.round(performance.now() - startTime)

    const reason = changes.find(c => c.kind !== "unknown")?.kind ?? batchKind
    const changePath = changes.find(c => c.kind !== "unknown")?.relativePath

    if (ok) {
      const eventPath = changePath ?? undefined
      const reloadEvent: Extract<DevReloadEvent, { type: "reload" }> = {
        type: "reload",
        reason: reason ?? "unknown",
        revision
      }
      if (eventPath !== undefined) {
        reloadEvent.path = eventPath
      }
      options.channel.broadcast(reloadEvent)

      if (!options.quiet) {
        logReload(reason ?? "unknown", eventPath, durationMs, routesRescanned, options.debug)
      }
    } else {
      const errorMsg = error instanceof Error ? error.message : String(error)
      options.channel.broadcast({
        type: "error",
        message: errorMsg,
        revision
      })

      if (!options.quiet) {
        logReloadError(reason ?? "unknown", durationMs, options.debug)
      }
    }
  }

  function getRevision(): number {
    return revision
  }

  function getManifest(): RouteManifest {
    return manifest
  }

  function getConfig(): ResolvedBoronixConfig {
    return config
  }

  function setLastError(error: unknown): void {
    lastError = error
  }

  function clearLastError(): void {
    lastError = null
  }

  function hasError(): boolean {
    return lastError !== null
  }

  return {
    handleChanges,
    getRevision,
    getManifest,
    getConfig,
    setLastError,
    clearLastError,
    hasError
  }
}

function logReload(kind: string, filePath: string | undefined, durationMs: number, routesRescanned: boolean, debug: boolean): void {
  const pathStr = filePath ? ` ${filePath}` : ""
  if (routesRescanned) {
    console.log(`\x1b[32m\u2714\x1b[0m routes  rescanned  ${durationMs}ms`)
  }
  if (debug) {
    console.log(`\x1b[32m\u2714\x1b[0m reload  ${kind}${pathStr}  ${durationMs}ms`)
  } else {
    const label = kind === "public-asset" ? "asset" : kind === "config" ? "config" : "reload"
    console.log(`\x1b[32m\u2714\x1b[0m ${label.padEnd(7)}${pathStr}  ${durationMs}ms`)
  }
}

function logReloadError(kind: string, durationMs: number, debug: boolean): void {
  console.log(`\x1b[33m\u26a0\x1b[0m ${kind.padEnd(7)} reload failed  ${durationMs}ms`)
}

import os from "node:os"
import path from "node:path"
import { createFileWatcher, type FileWatcher } from "./watcher"
import { classifyChange } from "./change-classifier"
import { spawnDevChild, type DevChild } from "./child-process"
import type { DevFileChange, DevChangeKind } from "./types"
import type { ChildToSupervisorMessage } from "./protocol"
import { areColorsEnabled, getNetworkAddress, openBrowser } from "../cli/ui/terminal"
import { colors } from "../cli/ui/colors"
import { symbols } from "../cli/ui/symbols"

export type DevSupervisorOptions = {
  root: string
  runtime?: "bun" | "node" | "deno" | undefined
  port?: number | undefined
  host?: string | undefined
  plain?: boolean | undefined
  noColor?: boolean | undefined
  open?: boolean | undefined
  quiet?: boolean | undefined
  verbose?: boolean | undefined
  noReload?: boolean | undefined
  debugWatch?: boolean | undefined
}

type SupervisorState = "starting" | "ready" | "stopping-child" | "starting-child" | "error" | "shutting-down"

const RESTART_KINDS = new Set<DevChangeKind>(["route-module", "shared-module", "route-structure", "config", "env"])

export async function startDevSupervisor(options: DevSupervisorOptions): Promise<void> {
  const reloadEnabled = options.noReload !== true
  const startedAt = performance.now()
  let state: SupervisorState = "starting"
  let child: DevChild | undefined
  let watcher: FileWatcher | undefined
  let revision = 0
  let shuttingDown = false
  let restartQueued = false
  let queuedPath: string | undefined
  let queuedKind: DevChangeKind | undefined
  let headerPrinted = false
  let readyResolve: (() => void) | undefined
  let readyReject: ((error: Error) => void) | undefined
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject })

  function debug(message: string): void {
    if (options.debugWatch) console.log(message)
  }

  function printHeader(message: Extract<ChildToSupervisorMessage, { type: "ready" }>): void {
    if (headerPrinted) return
    headerPrinted = true
    const isPlain = !areColorsEnabled()
    const localHost = message.host === "0.0.0.0" ? "localhost" : message.host
    const localUrl = `http://${localHost}:${message.port}`
    const displayRoot = options.root.startsWith(os.homedir()) ? options.root.replace(os.homedir(), "~") : options.root
    if (isPlain) {
      console.log("* Boronix\n")
      console.log("  mode      dev")
      console.log(`  runtime   ${options.runtime ?? "bun"}`)
      console.log(`  local     ${localUrl}`)
      if (message.host === "0.0.0.0" && getNetworkAddress()) console.log(`  network   http://${getNetworkAddress()}:${message.port}`)
      console.log(`  root      ${displayRoot}`)
      console.log(`  reload    ${reloadEnabled ? "enabled" : "disabled"}\n`)
      console.log(`ready, serving HTML in ${Math.round(performance.now() - startedAt)}ms`)
    } else {
      console.log(`${colors.brand(symbols.header())} ${colors.bold("Boronix")}`)
      console.log(`\n  ${colors.success(symbols.success())} ${colors.muted("mode").padEnd(9)} ${colors.bold("dev")}`)
      console.log(`  ${colors.success(symbols.success())} ${colors.muted("runtime").padEnd(9)} ${colors.bold(options.runtime ?? "bun")}`)
      console.log(`  ${colors.brand(symbols.redirect())} ${colors.muted("local").padEnd(9)} ${colors.bold(localUrl)}`)
      console.log(`  ${colors.bold(symbols.home())} ${colors.muted("root").padEnd(9)} ${colors.bold(displayRoot)}`)
      console.log(`  ${colors.brand(symbols.output())} ${colors.muted("reload").padEnd(9)} ${colors.bold(reloadEnabled ? "enabled" : "disabled")}`)
      console.log(`\n${colors.success(symbols.success())} ${colors.bold("ready")}, serving HTML in ${colors.bold(`${Math.round(performance.now() - startedAt)}ms`)}`)
    }
    if (options.open) void openBrowser(localUrl)
  }

  function logChange(action: "reload" | "restart" | "failed", kind: DevChangeKind, filePath: string | undefined, duration: number): void {
    if (options.quiet && action !== "failed") return
    const label = action === "failed" ? "restart" : action
    const icon = action === "failed" ? "✖" : "✔"
    console.log(`${icon} ${label.padEnd(7)}${filePath ? ` ${filePath}` : ` ${kind}`}  ${duration}ms`)
  }

  async function spawn(reason?: string, changedPath?: string): Promise<void> {
    if (shuttingDown) return
    state = "starting-child"
    const nextRevision = revision + 1
    const start = performance.now()
    child = spawnDevChild({
      root: options.root,
      runtime: options.runtime ?? "bun",
      port: options.port,
      host: options.host,
      revision: nextRevision,
      quiet: options.quiet,
      verbose: options.verbose,
      plain: options.plain,
      noColor: options.noColor,
      reloadEnabled,
      onMessage(message) {
        if (message.type === "ready") {
          revision = message.revision
          state = "ready"
          printHeader(message)
          debug(`child ready pid=${message.pid} revision=${revision}`)
          if (reason) logChange("restart", queuedKind ?? "route-module", changedPath, Math.round(performance.now() - start))
          readyResolve?.(); readyResolve = undefined
          if (restartQueued) {
            const nextPath = queuedPath
            restartQueued = false; queuedPath = undefined
            void restart(nextPath)
          }
        } else if (message.type === "error") {
          state = "error"
          console.error(`✖ restart failed${changedPath ? `\n  ${changedPath}` : ""}\n  ${message.message}`)
          debug(`child error pid=${message.pid} revision=${message.revision}`)
          if (!headerPrinted) {
            const error = new Error(message.message)
            if (message.code) (error as Error & { code?: string }).code = message.code
            readyReject?.(error)
            readyReject = undefined
          }
        } else if (message.type === "stopped") {
          debug(`child stopped pid=${message.pid}`)
        }
      },
      onOutput(line, isError) {
        // Worker protocol frames were removed before this point.
        ;(isError ? console.error : console.log)(line)
      },
      onExit(code, signal) {
        debug(`child exit code=${code ?? "null"} signal=${signal ?? "none"}`)
        if (!shuttingDown && state !== "stopping-child" && code && state !== "error") {
          state = "error"
          console.error(`✖ restart failed\n  KQ_DEV_CHILD_START_FAILED (exit ${code})`)
        }
      }
    })
  }

  async function restart(changedPath?: string): Promise<void> {
    if (shuttingDown) return
    if (state === "starting-child" || state === "stopping-child") {
      restartQueued = true
      queuedPath = changedPath ?? queuedPath
      return
    }
    state = "stopping-child"
    const oldPid = child?.pid
    debug(`restart child oldPid=${oldPid ?? "none"} newRevision=${revision + 1}`)
    if (child) await child.stop("source changed")
    child = undefined
    await spawn("restart", changedPath)
  }

  function handleChanges(changes: DevFileChange[]): void {
    const classified = changes.map(change => change.kind === "unknown" ? classifyChange(change.absolutePath, options.root, change.event) : change)
    const restartChange = classified.find(change => RESTART_KINDS.has(change.kind))
    if (restartChange) {
      queuedKind = restartChange.kind
      void restart(restartChange.relativePath)
      return
    }
    const reloadChange = classified.find(change => change.kind === "template" || change.kind === "public-asset")
    if (!reloadChange || state !== "ready" || !child) return
    revision += 1
    child.send({ type: "broadcast-reload", revision, reason: reloadChange.kind, path: reloadChange.relativePath })
    logChange("reload", reloadChange.kind, reloadChange.relativePath, 0)
  }

  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    state = "shutting-down"
    try { watcher?.close() } catch {}
    try { await child?.stop("supervisor shutdown") } catch {}
  }

  process.once("SIGINT", () => { void shutdown().then(() => process.exit(0)) })
  process.once("SIGTERM", () => { void shutdown().then(() => process.exit(0)) })
  await spawn()
  if (reloadEnabled) {
    watcher = createFileWatcher({ root: options.root, watchPaths: [options.root], debounceMs: 60, debug: options.debugWatch, onChange: handleChanges })
  }
  try {
    await ready
  } catch (error) {
    try { watcher?.close() } catch {}
    try { await child?.stop("initial startup failed") } catch {}
    throw error
  }
}

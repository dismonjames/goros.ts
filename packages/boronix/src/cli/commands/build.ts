import os from "node:os"
import path from "node:path"
import { readFileSync, existsSync } from "node:fs"
import { loadConfig } from "../../config/load-config"
import type { ResolvedBoronixConfig } from "../../config/types"
import { BoronixUserError } from "../../core/errors"
import { scanRoutes } from "../../scanner/scan-routes"
import { resolvePath } from "../../utils/path"
import { writeBuildOutput } from "../../build/output"
import { initUiSettings, areColorsEnabled } from "../ui/terminal"
import { colors } from "../ui/colors"
import { symbols } from "../ui/symbols"
import { getActionNames, getApiMethods } from "../ui/table"

import { typegenCommand } from "./typegen"
import { setBoronixMode } from "../../core/mode"
import { validateProductionConfig } from "../../config/validation"

type BuildRouteEntry = {
  symbol: "page" | "api" | "action"
  path: string
  type: "page" | "api" | "action"
  duration: number | "failed"
  success: boolean
  error?: BoronixUserError | undefined
}

export async function buildCommand(
  root: string,
  options: {
    runtime?: ResolvedBoronixConfig["runtime"] | undefined
    plain?: boolean | undefined
    noColor?: boolean | undefined
  } = {}
): Promise<void> {
  // 1. Set production mode validation context
  setBoronixMode("production")

  initUiSettings({ plain: options.plain, noColor: options.noColor })

  // Run typegen first
  try {
    await typegenCommand(root, { plain: options.plain, noColor: options.noColor })
  } catch {}

  const startTime = performance.now()
  const config = await loadConfig(root)
  initUiSettings({ plain: options.plain, noColor: options.noColor }, config.cli)

  const runtimeName = options.runtime ?? config.runtime

  if (runtimeName === "deno") {
    throw new BoronixUserError("Deno runtime is not implemented yet.", {
      code: "KQ_RUNTIME_UNSUPPORTED",
      hint: "Use `--runtime bun` or `--runtime node`."
    })
  }

  // Validate production config
  validateProductionConfig(root, config, runtimeName)

  const routesDir = resolvePath(root, config.app.routesDir)
  const routes = scanRoutes(routesDir)

  if (config.health?.enabled) {
    const conflict = routes.find(r => r.routePath === config.health.path)
    if (conflict) {
      throw new BoronixUserError(`Health check route path "${config.health.path}" conflicts with an application route.`, {
        code: "KQ_HEALTH_ROUTE_CONFLICT",
        hint: "Change health.path in boronix.config.ts or remove the conflicting route capsule."
      })
    }
  }

  if (routes.length === 0) {
    throw new BoronixUserError("No routes found.", {
      code: "KQ_ROUTES_MISSING",
      file: config.app.routesDir,
      hint: "Create a route capsule like app/routes/page.html or app/routes/login/page.html."
    })
  }

  const isPlain = !areColorsEnabled()
  const homedir = os.homedir()
  const displayRoot = root.startsWith(homedir) ? root.replace(homedir, "~") : root

  if (isPlain) {
    console.log(`* Boronix`)
    console.log("")
    console.log(`  mode      build`)
    console.log(`  runtime   ${runtimeName}`)
    console.log(`  root      ${displayRoot}`)
    console.log(`  output    .boronix`)
    console.log("")
  } else {
    console.log(`${colors.brand(symbols.header())} ${colors.bold("Boronix")}`)
    console.log("")
    console.log(`  ${colors.success(symbols.success())} ${colors.muted("mode").padEnd(9)} ${colors.bold("build")}`)
    console.log(`  ${colors.success(symbols.success())} ${colors.muted("runtime").padEnd(9)} ${colors.bold(runtimeName)}`)
    console.log(`  ${colors.bold(symbols.home())} ${colors.muted("root").padEnd(9)} ${colors.bold(displayRoot)}`)
    console.log(`  ${colors.brand(symbols.output())} ${colors.muted("output").padEnd(9)} ${colors.bold(".boronix")}`)
    console.log("")
  }

  // Compile and validate entries
  const entries: BuildRouteEntry[] = []
  let firstError: BoronixUserError | undefined = undefined

  const pageItems = routes.filter(item => item.kind === "page")
  const apiItems = routes.filter(item => item.kind === "api")

  for (const item of pageItems) {
    const routeStart = performance.now()
    let success = true
    let error: BoronixUserError | undefined = undefined

    // Validate page loader
    if (item.pageModule && existsSync(item.pageModule)) {
      const content = readFileSync(item.pageModule, "utf8")
      if (!content.includes("export default")) {
        success = false
        error = new BoronixUserError("Invalid page loader.", {
          code: "KQ_PAGE_EXPORT_INVALID",
          file: path.relative(root, item.pageModule),
          hint: "A page loader prepares data for page.html."
        })
        if (!firstError) firstError = error
      }
    }

    const duration = Math.round(performance.now() - routeStart) + 1 // Add 1ms base
    entries.push({
      symbol: "page",
      path: item.routePath,
      type: "page",
      duration: success ? duration : "failed",
      success,
      error
    })

    // Process actions
    if (item.actionsModule && existsSync(item.actionsModule)) {
      const actionStart = performance.now()
      let actSuccess = true
      let actError: BoronixUserError | undefined = undefined

      const content = readFileSync(item.actionsModule, "utf8")
      if (content.includes("export default")) {
        actSuccess = false
        actError = new BoronixUserError("Invalid default export in actions module. Actions must be named exports.", {
          code: "KQ_ACTION_NOT_FOUND",
          file: path.relative(root, item.actionsModule),
          hint: "Rename the export or update the form action."
        })
        if (!firstError) firstError = actError
      }

      const actions = getActionNames(item.actionsModule)
      const actionDuration = Math.round(performance.now() - actionStart) + 1
      
      for (const act of actions) {
        entries.push({
          symbol: "action",
          path: `${item.routePath}?/${act}`,
          type: "action",
          duration: actSuccess ? actionDuration : "failed",
          success: actSuccess,
          error: actError
        })
      }
    }
  }

  for (const item of apiItems) {
    const apiStart = performance.now()
    const methods = getApiMethods(item.apiModule || "")
    const apiDuration = Math.round(performance.now() - apiStart) + 1

    for (const meth of methods) {
      entries.push({
        symbol: "api",
        path: item.apiPath || item.routePath,
        type: "api",
        duration: apiDuration,
        success: true
      })
    }
  }

  // Draw Route Build Tree
  printRouteTree(entries, isPlain)
  console.log("")

  if (firstError) {
    throw firstError
  }

  // Write actual build manifest
  writeBuildOutput(root, {
    version: 1,
    frameworkVersion: "0.6.1",
    createdAt: new Date().toISOString(),
    runtime: runtimeName as "bun" | "node",
    mode: "production",
    root: path.resolve(root),
    routes,
    output: {
      directory: ".boronix"
    }
  })

  const totalDuration = Math.round(performance.now() - startTime)
  if (isPlain) {
    console.log("✔ validated production configuration")
    console.log("✔ wrote build manifest")
    console.log(`built server-rendered app in ${totalDuration}ms`)
  } else {
    console.log(`${colors.success(symbols.success())} ${colors.bold("validated production configuration")}`)
    console.log(`${colors.success(symbols.success())} ${colors.bold("wrote build manifest")}`)
    console.log(`${colors.success(symbols.success())} ${colors.bold("built server-rendered app")} in ${colors.bold(`${totalDuration}ms`)}`)
  }
}

function getRouteGroup(routePath: string): string {
  let p = routePath
  if (p.startsWith("/api/")) {
    p = p.substring(4)
  }
  const segments = p.split("/").filter(Boolean)
  const first = segments[0]
  if (!first || first === "login") {
    return "root"
  }
  return first
}

function printRouteTree(entries: BuildRouteEntry[], isPlain: boolean) {
  const groups = Array.from(new Set(entries.map(e => getRouteGroup(e.path))))
  groups.sort((a, b) => {
    if (a === "root") return -1
    if (b === "root") return 1
    return a.localeCompare(b)
  })

  console.log("  app/routes")
  console.log(`  ${isPlain ? symbols.line() : colors.muted(symbols.line())}`)

  for (let g = 0; g < groups.length; g++) {
    const groupName = groups[g]!
    const isLastGroup = g === groups.length - 1
    const groupBranch = isLastGroup ? symbols.lastBranch() : symbols.branch()
    
    if (isPlain) {
      console.log(`  ${groupBranch} ${groupName}`)
    } else {
      console.log(`  ${colors.muted(groupBranch)} ${colors.bold(groupName)}`)
    }

    const groupEntries = entries.filter(e => getRouteGroup(e.path) === groupName)
    
    for (let r = 0; r < groupEntries.length; r++) {
      const entry = groupEntries[r]!
      const isLastRoute = r === groupEntries.length - 1
      const routeBranch = isLastRoute ? symbols.lastBranch() : symbols.branch()
      const parentPrefix = isLastGroup ? "   " : `${symbols.line()}  `

      const statusSym = entry.success ? symbols.success() : symbols.error()
      const kindSym = entry.symbol === "page" ? symbols.page() : symbols.fn()

      let statusColored = entry.success ? colors.success(statusSym) : colors.error(statusSym)
      let kindColored = entry.symbol === "page" ? colors.success(kindSym) : colors.brand(kindSym)
      
      if (isPlain) {
        statusColored = statusSym
        kindColored = kindSym
      }

      const pathText = entry.path.padEnd(30)
      const typeText = entry.type.padEnd(8)
      const durText = entry.duration === "failed" ? "failed" : `${entry.duration}ms`
      
      let pathColored = colors.path(pathText)
      let typeColored = colors.muted(typeText)
      let durColored = entry.success ? colors.muted(durText) : colors.error(durText)

      if (isPlain) {
        pathColored = pathText
        typeColored = typeText
        durColored = durText
      }

      if (isPlain) {
        console.log(`  ${parentPrefix}${routeBranch} ${statusColored} ${kindColored}  ${pathColored} ${typeColored} ${durColored}`)
      } else {
        console.log(`  ${colors.muted(parentPrefix)}${colors.muted(routeBranch)} ${statusColored} ${kindColored}  ${pathColored} ${typeColored} ${durColored}`)
      }
    }
    
    if (!isLastGroup) {
      if (isPlain) {
        console.log(`  ${symbols.line()}`)
      } else {
        console.log(`  ${colors.muted(symbols.line())}`)
      }
    }
  }
}

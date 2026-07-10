import path from "node:path"
import { loadConfig } from "../../config/load-config"
import type { ResolvedBoronixConfig } from "../../config/types"
import { BoronixUserError } from "../../core/errors"
import { scanRoutes } from "../../scanner/scan-routes"
import { resolvePath } from "../../utils/path"
import { initUiSettings, areColorsEnabled } from "../ui/terminal"
import { colors } from "../ui/colors"
import { symbols } from "../ui/symbols"
import { getActionNames, getApiMethods } from "../ui/table"

type RouteListEntry = {
  symbol: "page" | "api" | "action"
  method: string
  path: string
  type: "page" | "api" | "action"
  source: string
}

export async function routesCommand(
  root: string,
  options: {
    plain?: boolean | undefined
    noColor?: boolean | undefined
    json?: boolean | undefined
    full?: boolean | undefined
    flat?: boolean | undefined
  } = {}
): Promise<void> {
  // If JSON mode, disable logs and suppress TTY formatting
  const isJson = !!options.json
  initUiSettings({ plain: options.plain || isJson, noColor: options.noColor || isJson })

  const config = await loadConfig(root)
  initUiSettings({ plain: options.plain || isJson, noColor: options.noColor || isJson }, config.cli)

  const routesDir = resolvePath(root, config.app.routesDir)
  const routes = scanRoutes(routesDir)

  if (routes.length === 0) {
    if (isJson) {
      console.log("[]")
      return
    }
    throw new BoronixUserError("No routes found.", {
      code: "KQ_ROUTES_MISSING",
      file: config.app.routesDir,
      hint: "Create a route capsule like app/routes/page.html or app/routes/login/page.html."
    })
  }

  const entries: RouteListEntry[] = []
  const pageItems = routes.filter(item => item.kind === "page")
  const apiItems = routes.filter(item => item.kind === "api")

  for (const item of pageItems) {
    const rawSource = item.pageHtml || item.pageModule || ""
    const sourcePath = options.full ? path.resolve(rawSource) : path.relative(root, rawSource)
    
    entries.push({
      symbol: "page",
      method: "GET",
      path: item.routePath,
      type: "page",
      source: sourcePath
    })

    if (item.actionsModule) {
      const actions = getActionNames(item.actionsModule)
      const actionSource = options.full ? path.resolve(item.actionsModule) : path.relative(root, item.actionsModule)
      for (const act of actions) {
        entries.push({
          symbol: "action",
          method: "POST",
          path: `${item.routePath}?/${act}`,
          type: "action",
          source: actionSource
        })
      }
    }
  }

  for (const item of apiItems) {
    const apiSource = options.full ? path.resolve(item.apiModule || "") : path.relative(root, item.apiModule || "")
    const methods = getApiMethods(item.apiModule || "")
    for (const meth of methods) {
      entries.push({
        symbol: "api",
        method: meth,
        path: item.apiPath || item.routePath,
        type: "api",
        source: apiSource
      })
    }
  }

  // --- Output Modes ---

  // 1. JSON Mode
  if (isJson) {
    const jsonOutput = entries.map(e => ({
      method: e.method,
      path: e.path,
      pattern: e.path,
      kind: e.type,
      file: e.source,
      type: e.type,
      source: e.source
    }))
    console.log(JSON.stringify(jsonOutput, null, 2))
    return
  }

  const isPlain = !areColorsEnabled()

  // Print Header
  if (isPlain) {
    console.log(`* Boronix routes`)
  } else {
    console.log(`${colors.brand(symbols.header())} ${colors.bold("Boronix routes")}`)
  }
  console.log("")

  // 2. Flat Mode
  if (options.flat) {
    const maxMethodLen = Math.max(...entries.map(e => e.method.length), 1)
    const maxPathLen = Math.max(...entries.map(e => e.path.length), 1)
    const maxTypeLen = Math.max(...entries.map(e => e.type.length), 1)

    for (const entry of entries) {
      const methText = entry.method.padEnd(maxMethodLen + 2)
      const pathText = entry.path.padEnd(maxPathLen + 2)
      const typeText = entry.type.padEnd(maxTypeLen + 2)

      const methColored = isPlain ? methText : colors.brand(methText)
      const pathColored = isPlain ? pathText : colors.path(pathText)
      const typeColored = isPlain ? typeText : colors.muted(typeText)
      const sourceColored = isPlain ? entry.source : colors.muted(entry.source)

      console.log(`  ${methColored} ${pathColored} ${typeColored} ${sourceColored}`)
    }
    console.log("")
  } else {
    // 3. Tree Mode (Default)
    printRouteListTree(entries, isPlain)
    console.log("")
  }

  // Footer count
  if (isPlain) {
    console.log(`OK found ${entries.length} routes`)
  } else {
    console.log(`${colors.success(symbols.success())} ${colors.bold(`found ${entries.length} routes`)}`)
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

function printRouteListTree(entries: RouteListEntry[], isPlain: boolean) {
  const groups = Array.from(new Set(entries.map(e => getRouteGroup(e.path))))
  groups.sort((a, b) => {
    if (a === "root") return -1
    if (b === "root") return 1
    return a.localeCompare(b)
  })

  console.log("  app/routes")
  console.log(`  ${isPlain ? symbols.line() : colors.muted(symbols.line())}`)

  const maxMethodLen = Math.max(...entries.map(e => e.method.length), 1)
  const maxPathLen = Math.max(...entries.map(e => e.path.length), 1)
  const maxTypeLen = Math.max(...entries.map(e => e.type.length), 1)

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

      const kindSym = entry.symbol === "page" ? symbols.page() : symbols.fn()
      let kindColored = entry.symbol === "page" ? colors.success(kindSym) : colors.brand(kindSym)
      if (isPlain) kindColored = kindSym

      const methText = entry.method.padEnd(maxMethodLen + 2)
      const pathText = entry.path.padEnd(maxPathLen + 2)
      const typeText = entry.type.padEnd(maxTypeLen + 2)

      let methColored = colors.brand(methText)
      let pathColored = colors.path(pathText)
      let typeColored = colors.muted(typeText)
      let sourceColored = colors.muted(entry.source)

      if (isPlain) {
        methColored = methText
        pathColored = pathText
        typeColored = typeText
        sourceColored = entry.source
      }

      if (isPlain) {
        console.log(`  ${parentPrefix}${routeBranch} ${kindColored}  ${methColored} ${pathColored} ${typeColored} ${sourceColored}`)
      } else {
        console.log(`  ${colors.muted(parentPrefix)}${colors.muted(routeBranch)} ${kindColored}  ${methColored} ${pathColored} ${typeColored} ${sourceColored}`)
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

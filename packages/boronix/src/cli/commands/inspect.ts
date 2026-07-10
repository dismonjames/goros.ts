import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { loadConfig } from "../../config/load-config"
import type { ResolvedBoronixConfig } from "../../config/types"
import { BoronixUserError } from "../../core/errors"
import { matchRoute } from "../../core/router"
import { scanRoutes } from "../../scanner/scan-routes"
import { resolvePath } from "../../utils/path"
import { initUiSettings, areColorsEnabled } from "../ui/terminal"
import { colors } from "../ui/colors"
import { symbols } from "../ui/symbols"

export async function inspectCommand(
  root: string,
  routePath: string,
  options: {
    plain?: boolean | undefined
    noColor?: boolean | undefined
    json?: boolean | undefined
    method?: string | undefined
  } = {}
): Promise<void> {
  initUiSettings({ plain: options.plain, noColor: options.noColor })

  const config = await loadConfig(root)
  initUiSettings({ plain: options.plain, noColor: options.noColor }, config.cli)

  const routesDir = resolvePath(root, config.app.routesDir)
  const manifest = scanRoutes(routesDir)

  const isPlain = !areColorsEnabled()

  const urlStr = routePath.startsWith("/") ? `http://localhost${routePath}` : `http://localhost/${routePath}`
  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    url = new URL("http://localhost/")
  }

  const pathname = url.pathname
  const search = url.search
  const actionName = search.startsWith("?/") ? decodeURIComponent(search.slice(2)) : undefined
  const method = options.method || (actionName ? "POST" : "GET")
  const isApi = pathname.startsWith("/api/")
  const requestKind = actionName ? "action" : (isApi ? "api" : "page")

  try {
    let matched = isApi ? matchRoute(manifest, pathname, "api") : matchRoute(manifest, pathname, "page")
    if (!matched && !isApi) {
      matched = matchRoute(manifest, pathname, "api")
    }

    if (!matched) {
      throw new BoronixUserError(`No route matched \`${routePath}\`.`, {
        code: "KQ_ROUTE_NOT_FOUND",
        hint: "Run `boronix routes` to see available routes."
      })
    }

    const item = matched.item
    const params = matched.params
    const paramKeys = Object.keys(params)

    if (requestKind === "action") {
      if (!item.actionsModule || !existsSync(item.actionsModule)) {
        throw new BoronixUserError(`Action "${actionName}" was not found for route "${item.routePath}".`, {
          code: "KQ_ACTION_NOT_FOUND",
          file: item.actionsModule ? path.relative(root, item.actionsModule) : undefined,
          hint: "Ensure actions.ts exists and exports the action function."
        })
      }
      let hasAction = false
      try {
        const mod = await import(pathToFileURL(item.actionsModule).href)
        hasAction = typeof mod[actionName!] === "function"
      } catch {
        const content = readFileSync(item.actionsModule, "utf8")
        const regex = new RegExp(`export\\s+const\\s+${actionName}\\s*=`, "g")
        hasAction = regex.test(content)
      }
      if (!hasAction) {
        throw new BoronixUserError(`Action "${actionName}" was not found for route "${item.routePath}".`, {
          code: "KQ_ACTION_NOT_FOUND",
          file: path.relative(root, item.actionsModule),
          hint: `Expected export:\nexport const ${actionName} = action(async () => {\n  ...\n})`
        })
      }
    }

    if (requestKind === "api") {
      if (!item.apiModule || !existsSync(item.apiModule)) {
        throw new BoronixUserError(`API not found for route "${item.routePath}".`, {
          code: "KQ_API_NOT_FOUND",
          file: item.apiModule ? path.relative(root, item.apiModule) : undefined,
          hint: "Ensure api.ts exists."
        })
      }
    }

    const layouts: string[] = []
    const rawSource = item.pageHtml || item.pageModule || item.apiModule || ""
    if (rawSource) {
      let currentDir = path.dirname(resolvePath(root, rawSource))
      const routesDirAbs = resolvePath(root, config.app.routesDir)
      const appDirAbs = path.dirname(routesDirAbs)

      while (currentDir.startsWith(appDirAbs)) {
        const layoutPath = path.join(currentDir, "layout.html")
        if (existsSync(layoutPath)) {
          layouts.push(path.relative(root, layoutPath))
        }
        if (currentDir === appDirAbs) break
        currentDir = path.dirname(currentDir)
      }
    }

    if (options.json) {
      const result: Record<string, any> = {
        success: true,
        routePath,
        matched: item.routePath,
        request: {
          method,
          kind: requestKind
        },
        files: {}
      }
      if (item.pageHtml) result.files.page = path.relative(root, item.pageHtml)
      if (item.pageModule) result.files.loader = path.relative(root, item.pageModule)
      if (item.actionsModule) result.files.action = path.relative(root, item.actionsModule)
      if (item.apiModule) result.files.api = path.relative(root, item.apiModule)

      if (requestKind === "action") {
        result.action = {
          name: actionName,
          file: item.actionsModule ? path.relative(root, item.actionsModule) : ""
        }
      }

      result.layouts = layouts
      console.log(JSON.stringify(result, null, 2))
      return
    }

    if (isPlain) {
      console.log(`* Boronix inspect`)
    } else {
      console.log(`${colors.brand(symbols.header())} ${colors.bold("Boronix inspect")}`)
    }
    console.log("")

    if (isPlain) {
      console.log(`  * ${routePath}`)
    } else {
      console.log(`  ${colors.brand(symbols.header())} ${colors.path(routePath)}`)
    }
    console.log(`  ${isPlain ? symbols.line() : colors.muted(symbols.line())}`)

    const hasParams = paramKeys.length > 0
    const matchedBranch = symbols.branch()
    
    if (isPlain) {
      console.log(`  ${matchedBranch} matched`)
      console.log(`  ${symbols.line()}  ${symbols.lastBranch()} ${item.routePath}`)
    } else {
      console.log(`  ${colors.muted(matchedBranch)} ${colors.bold("matched")}`)
      console.log(`  ${colors.muted(symbols.line())}  ${colors.muted(symbols.lastBranch())} ${colors.path(item.routePath)}`)
    }

    if (isPlain) {
      console.log(`  ${symbols.line()}`)
      console.log(`  ${symbols.branch()} request`)
      console.log(`  ${symbols.line()}  ${symbols.branch()} method  ${method}`)
      console.log(`  ${symbols.line()}  ${symbols.lastBranch()} kind    ${requestKind}`)
    } else {
      console.log(`  ${colors.muted(symbols.line())}`)
      console.log(`  ${colors.muted(symbols.branch())} ${colors.bold("request")}`)
      console.log(`  ${colors.muted(symbols.line())}  ${colors.muted(symbols.branch())} ${colors.muted("method").padEnd(8)} ${colors.bold(method)}`)
      console.log(`  ${colors.muted(symbols.line())}  ${colors.muted(symbols.lastBranch())} ${colors.muted("kind").padEnd(8)} ${colors.bold(requestKind)}`)
    }

    if (requestKind === "action" && actionName) {
      if (isPlain) {
        console.log(`  ${symbols.line()}`)
        console.log(`  ${symbols.branch()} action`)
        console.log(`  ${symbols.line()}  ${symbols.branch()} name    ${actionName}`)
        console.log(`  ${symbols.line()}  ${symbols.lastBranch()} file    ${item.actionsModule ? path.relative(root, item.actionsModule) : ""}`)
      } else {
        console.log(`  ${colors.muted(symbols.line())}`)
        console.log(`  ${colors.muted(symbols.branch())} ${colors.bold("action")}`)
        console.log(`  ${colors.muted(symbols.line())}  ${colors.muted(symbols.branch())} ${colors.muted("name").padEnd(8)} ${colors.bold(actionName)}`)
        console.log(`  ${colors.muted(symbols.line())}  ${colors.muted(symbols.lastBranch())} ${colors.muted("file").padEnd(8)} ${colors.path(item.actionsModule ? path.relative(root, item.actionsModule) : "")}`)
      }
    }

    if (hasParams) {
      if (isPlain) {
        console.log(`  ${symbols.line()}`)
        console.log(`  ${symbols.branch()} params`)
        for (let i = 0; i < paramKeys.length; i++) {
          const key = paramKeys[i]!
          const isLastParam = i === paramKeys.length - 1
          const paramBranch = isLastParam ? symbols.lastBranch() : symbols.branch()
          console.log(`  ${symbols.line()}  ${paramBranch} ${key}  ${params[key]}`)
        }
      } else {
        console.log(`  ${colors.muted(symbols.line())}`)
        console.log(`  ${colors.muted(symbols.branch())} ${colors.bold("params")}`)
        for (let i = 0; i < paramKeys.length; i++) {
          const key = paramKeys[i]!
          const isLastParam = i === paramKeys.length - 1
          const paramBranch = isLastParam ? symbols.lastBranch() : symbols.branch()
          console.log(`  ${colors.muted(symbols.line())}  ${colors.muted(paramBranch)} ${colors.brand(key.padEnd(5))} ${colors.path(String(params[key]))}`)
        }
      }
    }

    if (isPlain) {
      console.log(`  ${symbols.line()}`)
      console.log(`  ${layouts.length > 0 ? symbols.branch() : symbols.lastBranch()} files`)
    } else {
      console.log(`  ${colors.muted(symbols.line())}`)
      console.log(`  ${colors.muted(layouts.length > 0 ? symbols.branch() : symbols.lastBranch())} ${colors.bold("files")}`)
    }

    const fileRows: { label: string; file: string }[] = []
    if (item.pageHtml) {
      fileRows.push({ label: "page", file: path.relative(root, item.pageHtml) })
    }
    if (item.pageModule) {
      fileRows.push({ label: "loader", file: path.relative(root, item.pageModule) })
    }
    if (item.actionsModule) {
      fileRows.push({ label: "action", file: path.relative(root, item.actionsModule) })
    }
    if (item.apiModule) {
      fileRows.push({ label: "api", file: path.relative(root, item.apiModule) })
    }

    for (let i = 0; i < fileRows.length; i++) {
      const row = fileRows[i]!
      const isLastRow = i === fileRows.length - 1
      const fileBranch = isLastRow ? symbols.lastBranch() : symbols.branch()
      const parentPrefix = layouts.length > 0 ? `${symbols.line()}  ` : "   "

      const labelStr = row.label.padEnd(8)
      if (isPlain) {
        console.log(`  ${parentPrefix}${fileBranch} ${labelStr} ${row.file}`)
      } else {
        console.log(`  ${colors.muted(parentPrefix)}${colors.muted(fileBranch)} ${colors.muted(labelStr)} ${colors.path(row.file)}`)
      }
    }

    if (layouts.length > 0) {
      if (isPlain) {
        console.log(`  ${symbols.line()}`)
        console.log(`  ${symbols.lastBranch()} layouts`)
      } else {
        console.log(`  ${colors.muted(symbols.line())}`)
        console.log(`  ${colors.muted(symbols.lastBranch())} ${colors.bold("layouts")}`)
      }
      for (let i = 0; i < layouts.length; i++) {
        const lay = layouts[i]!
        const isLastLay = i === layouts.length - 1
        const layBranch = isLastLay ? symbols.lastBranch() : symbols.branch()
        if (isPlain) {
          console.log(`     ${layBranch} ${lay}`)
        } else {
          console.log(`     ${colors.muted(layBranch)} ${colors.path(lay)}`)
        }
      }
    }

    console.log("")
    if (isPlain) {
      console.log(`✔ route resolved`)
    } else {
      console.log(`${colors.success(symbols.success())} ${colors.bold("route resolved")}`)
    }

  } catch (err: any) {
    const code = err.code || "KQ_ERROR"
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        code,
        message: err.message
      }, null, 2))
    } else {
      if (isPlain) {
        console.error(`✖ ${code}: ${err.message}`)
      } else {
        console.error(`${colors.error(symbols.error())} ${colors.bold(code)}: ${colors.error(err.message)}`)
      }
    }
    process.exit(1)
  }
}

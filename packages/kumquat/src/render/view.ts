import { existsSync } from "node:fs"
import path from "node:path"
import { readTextFile } from "../utils/fs"
import { renderTemplate } from "./template"

export type RenderPageViewOptions = {
  pageHtmlPath: string
  appRoot: string
  routesDir: string
  routeDir: string
  data: Record<string, unknown>
}

export function renderPageView(options: RenderPageViewOptions): string {
  const { pageHtmlPath, appRoot, routesDir, routeDir, data } = options
  const pageHtml = readTextFile(pageHtmlPath)
  let html = renderTemplate(pageHtml, data)
  const layouts = collectLayouts(appRoot, routesDir, routeDir)

  for (const layoutPath of layouts.reverse()) {
    const layout = readTextFile(layoutPath)
    if (!layout.includes("{{ slot }}") && !layout.includes("{{slot}}") && !layout.includes("{{ body }}") && !layout.includes("{{body}}")) {
      console.warn(`Layout is missing {{ slot }}: ${layoutPath}`)
    }
    html = renderTemplate(layout, { ...data, slot: html, body: html }, { rawKeys: new Set(["slot", "body"]) })
  }

  return html
}

export function collectLayouts(appRoot: string, routesDir: string, routeDir: string): string[] {
  const layouts: string[] = []
  const globalLayout = path.join(appRoot, "layout.html")

  if (existsSync(globalLayout)) {
    layouts.push(globalLayout)
  }

  const relativeRouteDir = path.relative(routesDir, routeDir)
  const segments = relativeRouteDir.split(path.sep).filter(Boolean)

  for (let index = 0; index < segments.length; index += 1) {
    const layoutPath = path.join(routesDir, ...segments.slice(0, index + 1), "layout.html")
    if (existsSync(layoutPath)) {
      layouts.push(layoutPath)
    }
  }

  return layouts
}

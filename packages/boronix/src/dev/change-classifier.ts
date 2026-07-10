import path from "node:path"
import type { DevChangeKind, DevFileChangeEvent, DevFileChange } from "./types"

const TEMPLATE_FILES = new Set(["page.html", "layout.html", "error.html", "not-found.html"])

const ROUTE_MODULE_FILES = new Set(["page.ts", "api.ts", "actions.ts"])

const SHARED_DIRS = ["app/server", "app/shared", "app/db"]

const IGNORED_PATTERNS = [
  "node_modules",
  ".git",
  ".boronix",
  ".boronix.tmp",
  "dist",
  "coverage",
  "drizzle",
]

const IGNORED_EXTENSIONS = [".db", ".db-journal", ".sqlite", ".sqlite3", "-wal", "-shm"]

const IGNORED_FILES = ["npm-debug.log", "bun.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]

export function isIgnoredPath(relativePath: string): boolean {
  const posix = relativePath.split(path.sep).join("/")

  for (const pattern of IGNORED_PATTERNS) {
    if (posix === pattern || posix.startsWith(pattern + "/")) return true
  }

  for (const ext of IGNORED_EXTENSIONS) {
    if (posix.endsWith(ext)) return true
  }

  const basename = path.basename(posix)
  if (IGNORED_FILES.includes(basename)) return true

  return false
}

export function classifyChange(
  absolutePath: string,
  root: string,
  event: DevFileChangeEvent
): DevFileChange {
  const relativePath = path.relative(root, absolutePath).split(path.sep).join("/")
  const detectedAt = Date.now()

  if (isIgnoredPath(relativePath)) {
    return { event, kind: "unknown", absolutePath, relativePath, detectedAt }
  }

  const basename = path.basename(absolutePath)
  const posix = relativePath

  if (posix === "boronix.config.ts" || posix === "kumquat.config.ts" || posix === "drizzle.config.ts") {
    return { event, kind: "config", absolutePath, relativePath, detectedAt }
  }

  if (posix === ".env" || posix === ".env.local") {
    return { event, kind: "env", absolutePath, relativePath, detectedAt }
  }

  if (posix.startsWith("public/")) {
    return { event, kind: "public-asset", absolutePath, relativePath, detectedAt }
  }

  if (posix.startsWith("app/routes/") || posix === "app/routes") {
    if (TEMPLATE_FILES.has(basename)) {
      return { event, kind: "template", absolutePath, relativePath, detectedAt }
    }
    if (ROUTE_MODULE_FILES.has(basename) || basename === "middleware.ts") {
      return { event, kind: "route-module", absolutePath, relativePath, detectedAt }
    }
    const segments = posix.split("/").filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    if (lastSegment !== undefined && !TEMPLATE_FILES.has(lastSegment) && !ROUTE_MODULE_FILES.has(lastSegment)) {
      return { event, kind: "route-structure", absolutePath, relativePath, detectedAt }
    }
    return { event, kind: "route-structure", absolutePath, relativePath, detectedAt }
  }

  if (posix === "app/middleware.ts") {
    return { event, kind: "shared-module", absolutePath, relativePath, detectedAt }
  }

  for (const dir of SHARED_DIRS) {
    if (posix === dir || posix.startsWith(dir + "/")) {
      return { event, kind: "shared-module", absolutePath, relativePath, detectedAt }
    }
  }

  if (basename === "layout.html" || basename === "error.html" || basename === "not-found.html") {
    return { event, kind: "template", absolutePath, relativePath, detectedAt }
  }

  return { event, kind: "unknown", absolutePath, relativePath, detectedAt }
}

export function shouldReload(kind: DevChangeKind): boolean {
  return kind !== "unknown"
}

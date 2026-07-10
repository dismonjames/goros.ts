import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { loadConfig } from "../../config/load-config"
import { scanRoutes } from "../../scanner/scan-routes"
import { resolvePath } from "../../utils/path"
import { initUiSettings, areColorsEnabled } from "../ui/terminal"
import { colors } from "../ui/colors"
import { symbols } from "../ui/symbols"
import { detectSessionUsage } from "../../utils/session-usage"
import { readBuildManifest, validateBuildManifest } from "../../build/manifest"

type CheckResult = {
  label: string
  status: "success" | "warning" | "error"
  hint?: string | undefined
}

export async function doctorCommand(
  root: string,
  options: {
    plain?: boolean | undefined
    noColor?: boolean | undefined
    production?: boolean | undefined
    json?: boolean | undefined
  } = {}
): Promise<void> {
  const isPlain = options.plain || !areColorsEnabled()
  const isJson = options.json || false
  const isProductionMode = options.production || false

  if (!isJson) {
    initUiSettings({ plain: options.plain, noColor: options.noColor })
  }

  let config: any = null
  let configLoadError: any = null

  try {
    config = await loadConfig(root)
  } catch (err: any) {
    configLoadError = err
  }

  const projectChecks: CheckResult[] = []
  const productionChecks: CheckResult[] = []
  const databaseChecks: CheckResult[] = []
  const runtimeChecks: CheckResult[] = [] // For legacy doctor view

  // --- Category: project ---
  if (!isProductionMode) {
    // Legacy Doctor Checks
    const pkgExists = existsSync(path.join(root, "package.json"))
    projectChecks.push({
      label: pkgExists ? "package.json found" : "package.json missing",
      status: pkgExists ? "success" : "error",
      hint: !pkgExists ? "Create a `package.json` file in the project root." : undefined
    })

    const configExists = existsSync(path.join(root, "boronix.config.ts"))
    projectChecks.push({
      label: configExists ? "boronix.config.ts found" : "boronix.config.ts missing",
      status: configExists ? "success" : "error",
      hint: !configExists ? "Create a `boronix.config.ts` configuration file." : undefined
    })

    const routesDir = config ? resolvePath(root, config.app.routesDir) : path.join(root, "app/routes")
    const routesDirExists = existsSync(routesDir)
    projectChecks.push({
      label: routesDirExists ? "app/routes found" : "app/routes missing",
      status: routesDirExists ? "success" : "error",
      hint: !routesDirExists ? "Create `app/routes/page.html` or another route capsule." : undefined
    })

    const publicDir = config ? resolvePath(root, config.app.publicDir) : path.join(root, "public")
    const publicExists = existsSync(publicDir)
    projectChecks.push({
      label: publicExists ? "public/ found" : "public/ missing",
      status: publicExists ? "success" : "warning",
      hint: !publicExists ? "Create a `public` folder for static assets (optional)." : undefined
    })
  } else {
    // Production Doctor checks: project category (config, routes, runtime)
    // 1. config
    projectChecks.push({
      label: configLoadError ? "config       invalid" : "config       valid",
      status: configLoadError ? "error" : "success",
      hint: configLoadError ? `boronix.config.ts failed to load: ${configLoadError.message}` : undefined
    })

    // 2. routes
    const routesDir = config ? resolvePath(root, config.app.routesDir) : path.join(root, "app/routes")
    const routesDirExists = existsSync(routesDir)
    let routesValid = true
    let routesHint: string | undefined
    if (!routesDirExists) {
      routesValid = false
      routesHint = "app/routes directory missing."
    } else {
      try {
        const routes = scanRoutes(routesDir)
        if (routes.length === 0) {
          routesValid = false
          routesHint = "No routes found in app/routes."
        }
      } catch (err: any) {
        routesValid = false
        routesHint = err.message
      }
    }
    projectChecks.push({
      label: "routes",
      status: routesValid ? "success" : "error",
      hint: routesHint
    })

    // 3. runtime
    const currentRuntime = config ? config.runtime : "bun"
    const validRuntimes = ["bun", "node", "deno"]
    const runtimeValid = validRuntimes.includes(currentRuntime)
    projectChecks.push({
      label: "runtime",
      status: runtimeValid ? "success" : "error",
      hint: !runtimeValid ? `Runtime '${currentRuntime}' is not supported.` : undefined
    })
  }

  // --- Category: database ---
  const drizzleConfigExists = existsSync(path.join(root, "drizzle.config.ts"))
  if (drizzleConfigExists) {
    const schemaExists = existsSync(path.join(root, "app/db/schema.ts"))
    const clientExists = existsSync(path.join(root, "app/db/client.ts"))
    const drizzleKitInstalled = hasPackageDependency(root, "drizzle-kit")

    databaseChecks.push({
      label: "config",
      status: "success"
    })
    databaseChecks.push({
      label: schemaExists ? "schema" : "schema       missing",
      status: schemaExists ? "success" : "error",
      hint: !schemaExists ? "Create `app/db/schema.ts`." : undefined
    })
    databaseChecks.push({
      label: clientExists ? "client" : "client       missing",
      status: clientExists ? "success" : "error",
      hint: !clientExists ? "Create `app/db/client.ts`." : undefined
    })
    if (!isProductionMode) {
      databaseChecks.push({
        label: drizzleKitInstalled ? "drizzle-kit  installed" : "drizzle-kit  missing",
        status: drizzleKitInstalled ? "success" : "error",
        hint: !drizzleKitInstalled ? "Install `drizzle-kit` as a dev dependency." : undefined
      })
    }
  }

  // --- Category: routes (legacy) ---
  let duplicateRoutesFound = false
  let invalidCapsuleFound = false
  let capsuleErrors: string[] = []

  const routesDir = config ? resolvePath(root, config.app.routesDir) : path.join(root, "app/routes")
  const routesDirExists = existsSync(routesDir)

  if (!isProductionMode && routesDirExists) {
    try {
      const routes = scanRoutes(routesDir)
      const pagePaths = new Set<string>()
      const apiPaths = new Set<string>()
      for (const item of routes) {
        if (item.kind === "page") {
          if (pagePaths.has(item.routePath)) {
            duplicateRoutesFound = true
            capsuleErrors.push(`Duplicate page route found at path: ${item.routePath}`)
          }
          pagePaths.add(item.routePath)
        } else if (item.kind === "api") {
          const apiPath = item.apiPath ?? item.routePath
          if (apiPaths.has(apiPath)) {
            duplicateRoutesFound = true
            capsuleErrors.push(`Duplicate API route found at path: ${apiPath}`)
          }
          apiPaths.add(apiPath)
        }
      }

      for (const item of routes) {
        if (item.pageModule && existsSync(item.pageModule)) {
          const content = readFileSync(item.pageModule, "utf8")
          if (!content.includes("export default")) {
            invalidCapsuleFound = true
            capsuleErrors.push(`Invalid page export in ${path.relative(root, item.pageModule)}. Expected \`export default page(...)\``)
          }
        }
        if (item.actionsModule && existsSync(item.actionsModule)) {
          const content = readFileSync(item.actionsModule, "utf8")
          if (content.includes("export default")) {
            invalidCapsuleFound = true
            capsuleErrors.push(`Invalid default export in actions module ${path.relative(root, item.actionsModule)}. Actions must be named exports.`)
          }
        }
      }
    } catch (err: any) {
      invalidCapsuleFound = true
      capsuleErrors.push(err.message)
    }
  }

  // Legacy Category: routes
  const legacyRoutesChecks: CheckResult[] = []
  if (!isProductionMode) {
    const rootPage = path.join(routesDir, "page.html")
    const legacyHomePage = path.join(routesDir, "home", "page.html")
    if (existsSync(rootPage)) {
      legacyRoutesChecks.push({ label: "root route  app/routes/page.html", status: "success" })
    }
    if (existsSync(legacyHomePage) && !existsSync(rootPage)) {
      legacyRoutesChecks.push({
        label: "legacy      app/routes/home now maps to /home",
        status: "warning",
        hint: "KQ_LEGACY_HOME_ROUTE\napp/routes/home is no longer treated as the root route.\nMove page.html and page.ts from app/routes/home/ to app/routes/."
      })
    }
    legacyRoutesChecks.push({
      label: "no duplicate routes",
      status: duplicateRoutesFound ? "error" : "success",
      hint: duplicateRoutesFound ? capsuleErrors.filter(e => e.includes("Duplicate")).join("\n  ") : undefined
    })

    legacyRoutesChecks.push({
      label: "route capsules valid",
      status: invalidCapsuleFound ? "error" : "success",
      hint: invalidCapsuleFound ? capsuleErrors.filter(e => !e.includes("Duplicate")).join("\n  ") : undefined
    })
  }

  // --- Category: runtime (legacy) ---
  if (!isProductionMode) {
    const bunAvailable = hasBinary("bun")
    runtimeChecks.push({
      label: "bun available",
      status: bunAvailable ? "success" : "warning",
      hint: !bunAvailable ? "Install Bun runtime for maximum performance." : undefined
    })

    const nodeAvailable = hasBinary("node")
    runtimeChecks.push({
      label: "node available",
      status: nodeAvailable ? "success" : "warning",
      hint: !nodeAvailable ? "Install Node.js runtime fallback." : undefined
    })

    if (config) {
      const validRuntimes = ["bun", "node", "deno"]
      const runtimeValid = validRuntimes.includes(config.runtime)
      runtimeChecks.push({
        label: `runtime config valid (${config.runtime})`,
        status: runtimeValid ? "success" : "error",
        hint: !runtimeValid ? `Runtime '${config.runtime}' is not supported. Use 'bun' or 'node'.` : undefined
      })

      const isProductionEnv = process.env.NODE_ENV === "production" || process.env.BORONIX_ENV === "production"
      const isSecretDefault = config.session.secret === "boronix-dev-session-secret"
      if (isProductionEnv && isSecretDefault) {
        runtimeChecks.push({
          label: "session secret secure",
          status: "error",
          hint: "In production, session.secret must not use the development default value. Set SESSION_SECRET env variable."
        })
      }
    } else if (configLoadError) {
      runtimeChecks.push({
        label: "boronix.config.ts valid",
        status: "error",
        hint: `Config loading failed: ${configLoadError.message}`
      })
    }
  }

  // --- Category: production ---
  if (isProductionMode) {
    let manifestLoaded = false
    let manifestData: any = null
    let manifestError: any = null

    try {
      manifestData = readBuildManifest(root)
      validateBuildManifest(manifestData, config ? config.runtime : "bun")
      manifestLoaded = true
    } catch (err: any) {
      manifestError = err
    }

    // 1. build manifest
    productionChecks.push({
      label: "build manifest",
      status: manifestLoaded ? "success" : "error",
      hint: manifestError ? manifestError.message : undefined
    })

    // 2. build runtime
    let runtimeValid = false
    if (manifestLoaded && (manifestData.runtime === "bun" || manifestData.runtime === "node")) {
      runtimeValid = true
    }
    productionChecks.push({
      label: "build runtime",
      status: runtimeValid ? "success" : "error",
      hint: !runtimeValid ? "Manifest specifies an unsupported or missing build runtime." : undefined
    })

    // 3. output files
    const outputDirExists = existsSync(path.join(root, ".boronix"))
    const manifestExists = existsSync(path.join(root, ".boronix", "manifest.json"))
    productionChecks.push({
      label: "output files",
      status: (outputDirExists && manifestExists) ? "success" : "error",
      hint: !(outputDirExists && manifestExists) ? "Run `boronix build` first." : undefined
    })

    // 4. host and port
    let hostPortValid = true
    let hostPortHint: string | undefined
    if (config) {
      const port = config.server.port
      const host = config.server.host
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        hostPortValid = false
        hostPortHint = `Port ${port} is invalid. Host: ${host}`
      } else if (typeof host !== "string" || host.trim() === "") {
        hostPortValid = false
        hostPortHint = `Host "${host}" is invalid.`
      }
    } else {
      hostPortValid = false
      hostPortHint = "Configuration could not be loaded."
    }
    productionChecks.push({
      label: "host and port",
      status: hostPortValid ? "success" : "error",
      hint: hostPortHint
    })

    // 5. session configuration
    let sessionValid = true
    let sessionHint: string | undefined
    if (config) {
      const usesSession = detectSessionUsage(root)
      const isSecretDefault = config.session.secret === "boronix-dev-session-secret" || !config.session.secret
      if (usesSession && isSecretDefault) {
        sessionValid = false
        sessionHint = "Session is used but session.secret is missing or using default development value. Provide BORONIX_SESSION_SECRET."
      }
    } else {
      sessionValid = false
    }
    productionChecks.push({
      label: "session configuration",
      status: sessionValid ? "success" : "error",
      hint: sessionHint
    })

    // 6. public directory
    let publicDirValid = true
    let publicDirHint: string | undefined
    if (config) {
      const resolvedRoot = path.resolve(root)
      const publicDirResolved = path.resolve(resolvedRoot, config.app.publicDir)
      const relativePublic = path.relative(resolvedRoot, publicDirResolved)
      const isOutside = relativePublic.startsWith("..") || path.isAbsolute(relativePublic)
      const exists = existsSync(publicDirResolved)

      if (isOutside) {
        publicDirValid = false
        publicDirHint = `Public directory "${config.app.publicDir}" escapes project root.`
      } else if (!exists) {
        // Warning if public dir doesn't exist, wait, is it warning or error?
        // Requirement says "public directory không trỏ ra ngoài project root"
        // Let's make it a warning if it doesn't exist but is inside, and error if it escapes.
        // Wait, "public directory không trỏ ra ngoài project root" -> error if escapes.
        // Let's mark it success if inside, and warning if inside but doesn't exist.
        // Actually, if it exists and is inside, success!
      }
    } else {
      publicDirValid = false
    }
    productionChecks.push({
      label: "public directory",
      status: publicDirValid ? "success" : "error",
      hint: publicDirHint
    })
  }

  // Count errors
  let errorsCount = 0
  let warningsCount = 0
  const hints: string[] = []

  const allCategoriesChecks = [
    { name: "project", checks: projectChecks },
    ...(isProductionMode ? [{ name: "production", checks: productionChecks }] : [{ name: "routes", checks: legacyRoutesChecks }]),
    ...(databaseChecks.length > 0 ? [{ name: "database", checks: databaseChecks }] : []),
    ...(!isProductionMode ? [{ name: "runtime", checks: runtimeChecks }] : [])
  ]

  for (const cat of allCategoriesChecks) {
    for (const c of cat.checks) {
      if (c.status === "warning") warningsCount++
      if (c.status === "error") errorsCount++
      if (c.hint) hints.push(c.hint)
    }
  }

  // JSON Output
  if (isJson) {
    const outputJson = {
      healthy: errorsCount === 0,
      categories: allCategoriesChecks.reduce((acc, cat) => {
        acc[cat.name] = cat.checks.map(c => ({
          label: c.label,
          status: c.status,
          hint: c.hint
        }))
        return acc
      }, {} as Record<string, any>)
    }
    console.log(JSON.stringify(outputJson, null, 2))
    process.exit(errorsCount > 0 ? 1 : 0)
  }

  // Print results
  if (isPlain) {
    console.log(`* Boronix doctor`)
  } else {
    console.log(`${colors.brand(symbols.header())} ${colors.bold("Boronix doctor")}`)
  }
  console.log("")

  function printCategory(name: string, checks: CheckResult[]) {
    if (isPlain) {
      console.log(`  ${name}`)
    } else {
      console.log(`  ${colors.bold(name)}`)
    }

    for (let i = 0; i < checks.length; i++) {
      const c = checks[i]!
      const isLast = i === checks.length - 1
      const branch = isLast ? symbols.lastBranch() : symbols.branch()

      let sym = ""
      if (c.status === "success") {
        sym = isPlain ? "✔" : colors.success(symbols.success())
      } else if (c.status === "warning") {
        sym = isPlain ? "⚠" : colors.warning(symbols.warning())
      } else {
        sym = isPlain ? "✖" : colors.error(symbols.error())
      }

      const branchColored = isPlain ? branch : colors.muted(branch)
      console.log(`  ${branchColored} ${sym} ${c.label}`)
      if (c.status === "warning" && c.hint) {
        console.log(`      ${c.hint}`)
      }
    }
    console.log("")
  }

  for (const cat of allCategoriesChecks) {
    printCategory(cat.name, cat.checks)
  }

  if (errorsCount > 0) {
    if (isPlain) {
      console.log(`✖ ${errorsCount} issue${errorsCount > 1 ? "s" : ""} found`)
    } else {
      console.log(`${colors.error(symbols.error())} ${colors.bold(`${errorsCount} issue${errorsCount > 1 ? "s" : ""} found`)}`)
    }
    console.log("")
    console.log(colors.bold("Hint:"))
    for (const h of hints) {
      console.log(`  ${h}`)
    }
    process.exit(1)
  } else {
    if (isPlain) {
      console.log(`✔ project looks healthy`)
    } else {
      console.log(`${colors.success(symbols.success())} ${colors.bold("project looks healthy")}`)
    }
    process.exit(0)
  }
}

function hasBinary(bin: string): boolean {
  try {
    execSync(`which ${bin}`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function hasPackageDependency(root: string, dependencyName: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))
    return Boolean(pkg.dependencies?.[dependencyName] ?? pkg.devDependencies?.[dependencyName])
  } catch {
    return false
  }
}

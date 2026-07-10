import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import os from "node:os"

console.log("Running smoke pack test...")

const rootDir = path.resolve(".")
const boronixTar = path.join(rootDir, "packages/boronix/boronix-0.6.0.tgz")
const createTar = path.join(rootDir, "packages/create-boronix/create-boronix-0.6.0.tgz")

// Clean old tarballs if exist
if (existsSync(boronixTar)) rmSync(boronixTar)
if (existsSync(createTar)) rmSync(createTar)

// Pack packages
console.log("Packing packages...")
execSync("cd packages/boronix && bun pm pack", { stdio: "inherit" })
execSync("cd packages/create-boronix && bun pm pack", { stdio: "inherit" })

if (!existsSync(boronixTar) || !existsSync(createTar)) {
  console.error("✖ Packing failed")
  process.exit(1)
}

const tempDir = path.join(os.tmpdir(), `boronix-smoke-${Date.now()}`)
mkdirSync(tempDir, { recursive: true })

try {
  // Test create-boronix non-interactive scaffolding using the built script
  console.log("Testing create-boronix non-interactive...")
  execSync(`bun ${rootDir}/packages/create-boronix/dist/index.js my-app --template basic --runtime bun --db none --no-install --no-git`, {
    cwd: tempDir,
    stdio: "inherit"
  })

  const appPath = path.join(tempDir, "my-app")
  const scaffoldedPkgPath = path.join(appPath, "package.json")
  if (!existsSync(scaffoldedPkgPath)) {
    console.error("✖ Scaffolding package.json missing")
    process.exit(1)
  }
  if (!existsSync(path.join(appPath, "boronix.config.ts"))) {
    console.error("✖ Scaffolding boronix.config.ts missing")
    process.exit(1)
  }

  // Pre-clean template placeholder dependency to avoid registry resolve errors before local install
  const pkg = JSON.parse(readFileSync(scaffoldedPkgPath, "utf8"))
  if (pkg.dependencies && pkg.dependencies.boronix) {
    delete pkg.dependencies.boronix
  }
  writeFileSync(scaffoldedPkgPath, JSON.stringify(pkg, null, 2), "utf8")

  // Update dependencies in the scaffolded app to point to the local boronix tarball
  console.log("Installing local boronix tarball in scaffolded app...")
  execSync(`bun add ${boronixTar}`, { cwd: appPath, stdio: "inherit" })

  // Run doctor
  console.log("Running bunx boronix doctor...")
  execSync("bunx boronix doctor", { cwd: appPath, stdio: "inherit" })

  // Run typegen
  console.log("Running bunx boronix typegen...")
  execSync("bunx boronix typegen", { cwd: appPath, stdio: "inherit" })

  // Verify .boronix/types/routes.d.ts exists
  const typegenFile = path.join(appPath, ".boronix", "types", "routes.d.ts")
  if (!existsSync(typegenFile)) {
    console.error("✖ Typegen routes.d.ts file missing")
    process.exit(1)
  }
  console.log("✔ Typegen routes.d.ts verified")

  // Run build
  console.log("Running bunx boronix build...")
  execSync("bunx boronix build", { cwd: appPath, stdio: "inherit" })

  // Verify .boronix/manifest.json exists
  const manifestFile = path.join(appPath, ".boronix", "manifest.json")
  if (!existsSync(manifestFile)) {
    console.error("✖ Production manifest .boronix/manifest.json missing after build")
    process.exit(1)
  }

  // Verify manifest does not contain secrets
  const manifestContent = readFileSync(manifestFile, "utf8")
  if (manifestContent.includes("BORONIX_SESSION_SECRET") || manifestContent.includes("boronix-dev-session-secret")) {
    console.error("✖ Manifest contains secret values")
    process.exit(1)
  }
  console.log("✔ Manifest verified clean of secrets")

  // Run doctor --production
  console.log("Running bunx boronix doctor --production...")
  execSync("bunx boronix doctor --production", { cwd: appPath, stdio: "inherit" })
  console.log("✔ Doctor --production passed")

  // Run routes --json
  console.log("Running bunx boronix routes --json...")
  const routesJson = execSync("bunx boronix routes --json", { cwd: appPath }).toString()
  const parsed = JSON.parse(routesJson)
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error("✖ Invalid routes JSON output:", routesJson)
    process.exit(1)
  }
  console.log("✔ Routes parsed successfully:", parsed.length, "routes found")

  // Run inspect / --json
  console.log("Running bunx boronix inspect / --json...")
  const inspectJson = execSync("bunx boronix inspect / --json", { cwd: appPath }).toString()
  const parsedInspect = JSON.parse(inspectJson)
  if (!parsedInspect.success) {
    console.error("✖ Inspect failed:", inspectJson)
    process.exit(1)
  }
  console.log("✔ Inspect / parsed successfully:", parsedInspect.matched)

  // Start production server and fetch /
  const smokePort = 3999
  console.log(`Starting production server on port ${smokePort} for smoke test...`)
  const serverProc = Bun.spawn({
    cmd: ["bunx", "boronix", "start", "--port", String(smokePort)],
    cwd: appPath,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, BORONIX_SESSION_SECRET: "smoke-test-secret" }
  })

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 3000))

  try {
    // Fetch /
    console.log("Fetching / ...")
    const homeRes = await fetch(`http://localhost:${smokePort}/`)
    if (!homeRes.ok) {
      console.error(`✖ Fetch / returned status ${homeRes.status}`)
      process.exit(1)
    }
    console.log("✔ Fetch / succeeded")

    // Fetch a missing route and verify clean 404
    console.log("Fetching /nonexistent ...")
    const notFoundRes = await fetch(`http://localhost:${smokePort}/nonexistent`)
    if (notFoundRes.status !== 404) {
      console.error(`✖ Expected 404, got ${notFoundRes.status}`)
      process.exit(1)
    }
    console.log("✔ 404 response verified")

    // Verify request ID header
    const reqId = homeRes.headers.get("x-boronix-request-id")
    if (!reqId || !reqId.startsWith("req_")) {
      console.error("✖ Missing or invalid x-boronix-request-id header")
      process.exit(1)
    }
    console.log("✔ Request ID header verified")

    // Verify security headers in production
    const cto = homeRes.headers.get("x-content-type-options")
    if (cto !== "nosniff") {
      console.error(`✖ Expected X-Content-Type-Options: nosniff, got ${cto}`)
      process.exit(1)
    }
    console.log("✔ Security headers verified")

    // Fetch static asset and verify Cache-Control
    console.log("Fetching /style.css ...")
    const staticRes = await fetch(`http://localhost:${smokePort}/style.css`)
    if (!staticRes.ok) {
      console.error(`✖ Fetch /style.css returned status ${staticRes.status}`)
      process.exit(1)
    }
    const cacheControl = staticRes.headers.get("cache-control")
    if (!cacheControl || cacheControl === "no-store") {
      console.error(`✖ Static asset Cache-Control should be public caching, got: ${cacheControl}`)
      process.exit(1)
    }
    console.log(`✔ Static asset Cache-Control: ${cacheControl}`)

    // Verify dev SSE endpoint does NOT exist in production
    console.log("Verifying /__boronix/dev-events not in production...")
    const devEventsRes = await fetch(`http://localhost:${smokePort}/__boronix/dev-events`)
    if (devEventsRes.status !== 404) {
      console.error(`✖ Expected 404 for dev SSE endpoint in production, got ${devEventsRes.status}`)
      process.exit(1)
    }
    console.log("✔ Dev SSE endpoint correctly absent in production")

    // Verify production HTML does not contain dev client
    const homeHtml = await fetch(`http://localhost:${smokePort}/`).then(r => r.text())
    if (homeHtml.includes("data-boronix-dev-client")) {
      console.error("✖ Production HTML contains dev client script")
      process.exit(1)
    }
    console.log("✔ Production HTML clean of dev client")
  } finally {
    // Gracefully stop the server
    try {
      process.kill(serverProc.pid, "SIGTERM")
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000))
    try {
      process.kill(serverProc.pid, "SIGKILL")
    } catch {}
  }

  // Dev server smoke test
  console.log("Starting dev server smoke test...")
  const devPort = 3998
  const devProc = Bun.spawn({
    cmd: ["bunx", "boronix", "dev", "--port", String(devPort), "--no-color"],
    cwd: appPath,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, BORONIX_SESSION_SECRET: "smoke-test-secret" }
  })

  await new Promise(resolve => setTimeout(resolve, 3000))

  try {
    // Fetch / and verify dev client is injected
    console.log("Fetching dev / ...")
    const devHomeRes = await fetch(`http://localhost:${devPort}/`)
    if (!devHomeRes.ok) {
      console.error(`✖ Dev fetch / returned status ${devHomeRes.status}`)
      process.exit(1)
    }
    const devHomeHtml = await devHomeRes.text()
    if (!devHomeHtml.includes("data-boronix-dev-client")) {
      console.error("✖ Dev HTML missing dev client injection")
      process.exit(1)
    }
    console.log("✔ Dev client injection verified")

    // Verify SSE endpoint exists in dev
    console.log("Verifying dev SSE endpoint...")
    const sseRes = await fetch(`http://localhost:${devPort}/__boronix/dev-events`)
    if (sseRes.status !== 200) {
      console.error(`✖ Dev SSE endpoint returned ${sseRes.status}`)
      process.exit(1)
    }
    const sseContentType = sseRes.headers.get("content-type")
    if (!sseContentType || !sseContentType.includes("text/event-stream")) {
      console.error(`✖ Dev SSE content-type wrong: ${sseContentType}`)
      process.exit(1)
    }
    console.log("✔ Dev SSE endpoint verified")

    // Modify a server module. This must restart the isolated worker, not serve
    // a stale ESM export from the previous process.
    console.log("Modifying page.ts for isolated dev worker reload...")
    const homePageTsPath = path.join(appPath, "app", "routes", "home", "page.ts")
    writeFileSync(homePageTsPath, 'import { page } from "boronix"\n\nexport default page(() => ({ title: "worker-reload" }))\n', "utf8")
    let moduleReloaded = false
    for (let attempt = 0; attempt < 80; attempt++) {
      const html = await fetch(`http://localhost:${devPort}/`).then(r => r.text()).catch(() => "")
      if (html.includes("worker-reload")) {
        moduleReloaded = true
        break
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    if (!moduleReloaded) {
      console.error("✖ Dev worker reload did not load the updated page.ts export")
      process.exit(1)
    }
    console.log("✔ Dev isolated module reload verified")

    // Modify page.html and verify content changes
    console.log("Modifying page.html for dev reload...")
    const homePageHtmlPath = path.join(appPath, "app", "routes", "home", "page.html")
    const originalContent = readFileSync(homePageHtmlPath, "utf8")
    writeFileSync(homePageHtmlPath, originalContent + "\n<!-- dev reload test -->", "utf8")

    await new Promise(resolve => setTimeout(resolve, 1000))

    const devHomeRes2 = await fetch(`http://localhost:${devPort}/`)
    const devHomeHtml2 = await devHomeRes2.text()
    if (!devHomeHtml2.includes("dev reload test")) {
      console.error("✖ Dev reload did not pick up page.html change")
      process.exit(1)
    }
    console.log("✔ Dev template reload verified")

    // Restore original content
    writeFileSync(homePageHtmlPath, originalContent, "utf8")

    // Add a new route and verify it appears
    console.log("Adding /about route for dev structure reload...")
    const aboutDir = path.join(appPath, "app", "routes", "about")
    mkdirSync(aboutDir, { recursive: true })
    writeFileSync(path.join(aboutDir, "page.html"), "<h1>About Page</h1>", "utf8")

    await new Promise(resolve => setTimeout(resolve, 1000))

    const aboutRes = await fetch(`http://localhost:${devPort}/about`)
    if (!aboutRes.ok) {
      console.error(`✖ Dev /about returned status ${aboutRes.status}`)
      process.exit(1)
    }
    const aboutHtml = await aboutRes.text()
    if (!aboutHtml.includes("About Page")) {
      console.error("✖ Dev new route content not found")
      process.exit(1)
    }
    console.log("✔ Dev route structure reload verified")

    // Remove the route and verify 404
    console.log("Removing /about route...")
    rmSync(aboutDir, { recursive: true, force: true })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const aboutGoneRes = await fetch(`http://localhost:${devPort}/about`)
    if (aboutGoneRes.status !== 404) {
      console.error(`✖ Expected 404 after route removal, got ${aboutGoneRes.status}`)
      process.exit(1)
    }
    console.log("✔ Dev route removal verified")
  } finally {
    try {
      process.kill(devProc.pid, "SIGTERM")
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000))
    try {
      process.kill(devProc.pid, "SIGKILL")
    } catch {}
  }

  console.log("Testing create-boronix rejects SQLite on Node runtime...")
  try {
    execSync(`bun ${rootDir}/packages/create-boronix/dist/index.js sqlite-node-app --template basic --runtime node --db sqlite --no-install --no-git`, {
      cwd: tempDir,
      stdio: "pipe"
    })
    console.error("✖ SQLite scaffold should reject Node runtime")
    process.exit(1)
  } catch (err: any) {
    const output = `${err.stdout?.toString() ?? ""}${err.stderr?.toString() ?? ""}`
    if (!output.includes("KQ_CREATE_DB_RUNTIME_UNSUPPORTED")) {
      console.error("✖ SQLite Node runtime rejection missing expected error code:", output)
      process.exit(1)
    }
    if (existsSync(path.join(tempDir, "sqlite-node-app"))) {
      console.error("✖ Rejected SQLite Node scaffold still created a project directory")
      process.exit(1)
    }
  }

  console.log("Testing create-boronix SQLite database scaffold...")
  execSync(`bun ${rootDir}/packages/create-boronix/dist/index.js sqlite-app --template basic --runtime bun --db sqlite --no-install --no-git`, {
    cwd: tempDir,
    stdio: "inherit"
  })

  const sqliteAppPath = path.join(tempDir, "sqlite-app")
  const sqlitePkgPath = path.join(sqliteAppPath, "package.json")
  const sqlitePkg = JSON.parse(readFileSync(sqlitePkgPath, "utf8"))
  if (!sqlitePkg.dependencies?.["drizzle-orm"] || !sqlitePkg.devDependencies?.["drizzle-kit"]) {
    console.error("✖ SQLite scaffold missing Drizzle dependencies")
    process.exit(1)
  }
  if (!existsSync(path.join(sqliteAppPath, "app/db/schema.ts")) || !existsSync(path.join(sqliteAppPath, "app/routes/notes/page.ts"))) {
    console.error("✖ SQLite scaffold missing database or notes files")
    process.exit(1)
  }
  delete sqlitePkg.dependencies.boronix
  writeFileSync(sqlitePkgPath, JSON.stringify(sqlitePkg, null, 2), "utf8")

  console.log("Installing SQLite app dependencies...")
  execSync(`bun add ${boronixTar}`, { cwd: sqliteAppPath, stdio: "inherit" })
  execSync("bun install", { cwd: sqliteAppPath, stdio: "inherit" })

  console.log("Running SQLite app doctor...")
  execSync("bunx boronix doctor", { cwd: sqliteAppPath, stdio: "inherit" })

  console.log("Running SQLite app typegen...")
  execSync("bunx boronix typegen", { cwd: sqliteAppPath, stdio: "inherit" })

  console.log("Running SQLite app db push...")
  execSync("bunx boronix db push", { cwd: sqliteAppPath, stdio: "inherit" })

  console.log("Running SQLite app db seed...")
  execSync("bunx boronix db seed", { cwd: sqliteAppPath, stdio: "inherit" })

  console.log("Running SQLite app build...")
  execSync("bunx boronix build", { cwd: sqliteAppPath, stdio: "inherit" })

  console.log("Running SQLite app routes --json...")
  const sqliteRoutesJson = execSync("bunx boronix routes --json", { cwd: sqliteAppPath }).toString()
  const parsedSqliteRoutes = JSON.parse(sqliteRoutesJson)
  if (!Array.isArray(parsedSqliteRoutes) || !parsedSqliteRoutes.some((route: any) => route.path === "/notes")) {
    console.error("✖ SQLite routes JSON missing /notes:", sqliteRoutesJson)
    process.exit(1)
  }

  console.log("Running SQLite app inspect /notes --json...")
  const sqliteInspectJson = execSync("bunx boronix inspect /notes --json", { cwd: sqliteAppPath }).toString()
  const parsedSqliteInspect = JSON.parse(sqliteInspectJson)
  if (!parsedSqliteInspect.success) {
    console.error("✖ Inspect /notes failed:", sqliteInspectJson)
    process.exit(1)
  }

  console.log("Testing create-boronix Postgres database scaffold...")
  execSync(`bun ${rootDir}/packages/create-boronix/dist/index.js postgres-app --template basic --runtime node --db postgres --no-install --no-git`, {
    cwd: tempDir,
    stdio: "inherit"
  })
  const postgresAppPath = path.join(tempDir, "postgres-app")
  const postgresPkg = JSON.parse(readFileSync(path.join(postgresAppPath, "package.json"), "utf8"))
  if (!postgresPkg.dependencies?.postgres || !postgresPkg.dependencies?.["drizzle-orm"] || !postgresPkg.devDependencies?.["drizzle-kit"]) {
    console.error("✖ Postgres scaffold missing dependencies")
    process.exit(1)
  }
  if (!readFileSync(path.join(postgresAppPath, "drizzle.config.ts"), "utf8").includes('dialect: "postgresql"')) {
    console.error("✖ Postgres scaffold missing postgresql Drizzle config")
    process.exit(1)
  }

  // Test missing build manifest
  console.log("Testing start without build manifest...")
  const noBuildPath = path.join(tempDir, "no-build-test")
  mkdirSync(noBuildPath, { recursive: true })
  writeFileSync(path.join(noBuildPath, "package.json"), JSON.stringify({ name: "no-build-test", private: true }), "utf8")
  try {
    execSync(`bun ${rootDir}/packages/boronix/dist/cli/main.js start --root ${noBuildPath}`, {
      stdio: "pipe"
    })
    console.error("✖ Start without build manifest should fail")
    process.exit(1)
  } catch (err: any) {
    const output = `${err.stdout?.toString() ?? ""}${err.stderr?.toString() ?? ""}`
    if (!output.includes("KQ_BUILD_OUTPUT_NOT_FOUND") && !output.includes("Could not find .boronix/manifest.json")) {
      console.error("✖ Missing build manifest error not detected:", output)
      process.exit(1)
    }
  }
  console.log("✔ Missing build manifest correctly rejected")

  // Test corrupt manifest
  console.log("Testing start with corrupt manifest...")
  const corruptPath = path.join(tempDir, "corrupt-manifest-test")
  mkdirSync(corruptPath, { recursive: true })
  writeFileSync(path.join(corruptPath, "package.json"), JSON.stringify({ name: "corrupt-test", private: true }), "utf8")
  mkdirSync(path.join(corruptPath, ".boronix"), { recursive: true })
  writeFileSync(path.join(corruptPath, ".boronix", "manifest.json"), "{invalid", "utf8")
  try {
    execSync(`bun ${rootDir}/packages/boronix/dist/cli/main.js start --root ${corruptPath}`, {
      stdio: "pipe"
    })
    console.error("✖ Start with corrupt manifest should fail")
    process.exit(1)
  } catch (err: any) {
    const output = `${err.stdout?.toString() ?? ""}${err.stderr?.toString() ?? ""}`
    if (!output.includes("KQ_BUILD_MANIFEST_INVALID") && !output.includes("Build manifest is invalid or corrupt")) {
      console.error("✖ Corrupt manifest error not detected:", output)
      process.exit(1)
    }
  }
  console.log("✔ Corrupt manifest correctly rejected")

  console.log("✔ smoke-pack test completed successfully!")
} finally {
  console.log("Cleaning up temp directory...")
  rmSync(tempDir, { recursive: true, force: true })
  // Clean local tarballs
  if (existsSync(boronixTar)) rmSync(boronixTar)
  if (existsSync(createTar)) rmSync(createTar)
}

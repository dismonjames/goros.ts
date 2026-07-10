import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

console.log("Release check")

function runCmd(cmd: string) {
  try {
    execSync(cmd, { stdio: "inherit" })
    return true
  } catch {
    return false
  }
}

// 1. Run tests
const skipTests = process.env.BORONIX_SKIP_TESTS === "1" || process.env.GOROS_SKIP_TESTS === "1" || process.env.KUMQUAT_SKIP_TESTS === "1"
if (!skipTests) {
  if (!runCmd("bun test")) {
    console.error("✖ tests failed")
    process.exit(1)
  }
  console.log("✔ tests passed")
} else {
  console.log("✔ tests passed (skipped)")
}

// 2. Run typecheck
if (!runCmd("bun run typecheck")) {
  console.error("✖ typecheck failed")
  process.exit(1)
}
console.log("✔ typecheck passed")

// 3. Run build
if (!runCmd("bun run build")) {
  console.error("✖ build failed")
  process.exit(1)
}
console.log("✔ build passed")

// 4. Verify package metadata
const rootDir = path.resolve(".")
const packages = ["boronix", "create-boronix"]

for (const pkgName of packages) {
  const pkgPath = path.join(rootDir, "packages", pkgName, "package.json")
  if (!existsSync(pkgPath)) {
    console.error(`✖ package.json missing for ${pkgName}`)
    process.exit(1)
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  
  if (pkg.name !== pkgName) {
    console.error(`✖ package name mismatch: expected ${pkgName}, found ${pkg.name}`)
    process.exit(1)
  }

  if (pkg.version !== "0.6.0") {
    console.error(`✖ version mismatch for ${pkgName}: expected 0.6.0, found ${pkg.version}`)
    process.exit(1)
  }

  if (pkg.license !== "MPL-2.0") {
    console.error(`✖ license mismatch for ${pkgName}: expected MPL-2.0, found ${pkg.license}`)
    process.exit(1)
  }

  if (!pkg.bin) {
    console.error(`✖ bin missing in package.json for ${pkgName}`)
    process.exit(1)
  }

  if (pkg.repository.url !== "git+ssh://git@github.com/dismonjames/boronix.ts.git") {
    console.error(`✖ repository URL mismatch for ${pkgName}: found ${pkg.repository.url}`)
    process.exit(1)
  }

  // Check README and LICENSE exist
  const readmePath = path.join(rootDir, "packages", pkgName, "README.md")
  if (!existsSync(readmePath)) {
    console.error(`✖ README.md missing for ${pkgName}`)
    process.exit(1)
  }

  const licensePath = path.join(rootDir, "packages", pkgName, "LICENSE")
  if (!existsSync(licensePath)) {
    console.error(`✖ LICENSE missing for ${pkgName}`)
    process.exit(1)
  }

  // Verify dist files exist
  const filesToCheck = pkgName === "boronix" 
    ? ["dist/index.js", "dist/index.d.ts", "dist/cli/main.js", "dist/dev/worker.js"]
    : ["dist/index.js", "dist/index.d.ts"]

  for (const file of filesToCheck) {
    const filePath = path.join(rootDir, "packages", pkgName, file)
    if (!existsSync(filePath)) {
      console.error(`✖ build artifact missing: ${filePath}`)
      process.exit(1)
    }
  }
}

console.log("✔ package metadata valid")
console.log("✔ dist files found")

// 5. Verify create templates use ^0.6.0
const templatePkgPaths = [
  path.join(rootDir, "packages/create-boronix/src/templates/basic/package.json"),
  path.join(rootDir, "packages/create-boronix/src/templates/homework/package.json")
]
for (const tplPath of templatePkgPaths) {
  const tplPkg = JSON.parse(readFileSync(tplPath, "utf8"))
  if (tplPkg.dependencies?.boronix !== "^0.6.0") {
    console.error(`✖ Template ${tplPath} does not use ^0.6.0 for boronix`)
    process.exit(1)
  }
  if (!tplPkg.scripts?.["doctor:production"] || tplPkg.scripts["doctor:production"] !== "boronix doctor --production") {
    console.error(`✖ Template ${tplPath} missing doctor:production script`)
    process.exit(1)
  }
}
console.log("✔ create templates use ^0.6.0")

// 6. Verify production docs exist
const requiredDocs = [
  "docs/production.md",
  "docs/deployment.md",
  "docs/health-check.md",
  "docs/security.md",
  "docs/static-files.md",
  "docs/configuration.md",
  "docs/session.md",
  "docs/doctor.md",
  "docs/releases/v0.5.0-production-hardening.md",
  "docs/releases/github-v0.5.0.md",
  "docs/releases/v0.6.0-dev-server.md",
  "docs/releases/github-v0.6.0.md",
  "docs/dev-server.md",
  "docs/reloading.md"
]
for (const doc of requiredDocs) {
  if (!existsSync(path.join(rootDir, doc))) {
    console.error(`✖ Production doc missing: ${doc}`)
    process.exit(1)
  }
}
console.log("✔ production docs exist")

// 7. Verify manifest validator is exported
const indexSrc = readFileSync(path.join(rootDir, "packages/boronix/src/index.ts"), "utf8")
if (!indexSrc.includes("readBuildManifest") || !indexSrc.includes("validateBuildManifest")) {
  console.error("✖ Manifest validators not exported from index.ts")
  process.exit(1)
}
console.log("✔ manifest validators exported")

// 8. Check no hard-coded development secret in production path
const appSrc = readFileSync(path.join(rootDir, "packages/boronix/src/core/app.ts"), "utf8")
if (appSrc.includes("boronix-dev-session-secret") && !appSrc.includes("isSecretDefault")) {
  console.error("✖ Hard-coded development secret found in production path without guard")
  process.exit(1)
}
console.log("✔ no hard-coded development secret in production path")

// 9. Verify tarball has dist/README/LICENSE (check files field in package.json)
for (const pkgName of packages) {
  const pkgPath = path.join(rootDir, "packages", pkgName, "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  if (!pkg.files || !pkg.files.includes("dist") || !pkg.files.includes("README.md") || !pkg.files.includes("LICENSE")) {
    console.error(`✖ ${pkgName} package.json files field missing dist/README/LICENSE`)
    process.exit(1)
  }
}
console.log("✔ package tarball includes dist/README/LICENSE")

// 10. The isolated worker is the only supported server-module reload strategy.
const devSources = [
  "packages/boronix/src/core/app.ts",
  "packages/boronix/src/config/load-config.ts",
  "packages/boronix/src/dev/supervisor.ts",
  "packages/boronix/src/dev/worker.ts"
].map(file => readFileSync(path.join(rootDir, file), "utf8")).join("\n")
if (/import\([^\n]*[?](?:t=|boronix_rev)/.test(devSources)) {
  console.error("✖ legacy ESM cache-busting import found in production source")
  process.exit(1)
}
if (!devSources.includes("spawnDevChild") || !devSources.includes("broadcast-reload")) {
  console.error("✖ dev supervisor/worker protocol is incomplete")
  process.exit(1)
}
console.log("✔ isolated dev worker and cache-busting guard verified")

console.log("✔ all release checks passed successfully")
process.exit(0)

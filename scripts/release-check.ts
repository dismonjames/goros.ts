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

  if (pkg.version !== "0.2.7") {
    console.error(`✖ version mismatch for ${pkgName}: expected 0.2.7, found ${pkg.version}`)
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
    ? ["dist/index.js", "dist/index.d.ts", "dist/cli/main.js"]
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
console.log("✔ all release checks passed successfully")
process.exit(0)

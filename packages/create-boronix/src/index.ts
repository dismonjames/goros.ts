#!/usr/bin/env bun
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
async function run() {
  console.log("\x1b[38;5;208m◆\x1b[0m \x1b[1mcreate-boronix\x1b[0m\n")

  let projectName = ""
  let template = "basic"
  let runtime = "bun"
  let install = false
  let git = false

  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue
    if (arg === "--template") {
      const val = args[i + 1]
      if (val) {
        template = val
        i++
      }
    } else if (arg === "--runtime") {
      const val = args[i + 1]
      if (val) {
        runtime = val
        i++
      }
    } else if (arg === "--no-install") {
      install = false
    } else if (arg === "--install") {
      install = true
    } else if (arg === "--no-git") {
      git = false
    } else if (arg === "--git") {
      git = true
    } else if (!arg.startsWith("-")) {
      projectName = arg
    }
  }

  const isInteractive = !projectName && process.stdout.isTTY

  if (isInteractive) {
    const rl = readline.createInterface({ input, output })
    try {
      // 1. Project name
      const nameAns = await rl.question("Project name: (my-boronix-app): ")
      projectName = nameAns.trim() || "my-boronix-app"

      // Check if target directory already exists
      const checkPath = path.resolve(projectName)
      if (existsSync(checkPath)) {
        console.error(`\x1b[31m✖\x1b[0m \x1b[1mError:\x1b[0m Target directory already exists: ${projectName}`)
        process.exit(1)
      }

      // 2. Template
      const templateAns = await rl.question("Template: basic / homework (basic): ")
      const tClean = templateAns.trim().toLowerCase()
      template = tClean === "homework" ? "homework" : "basic"

      // 3. Runtime
      const runtimeAns = await rl.question("Runtime: bun / node (bun): ")
      const rClean = runtimeAns.trim().toLowerCase()
      runtime = rClean === "node" ? "node" : "bun"

      // 4. Install dependencies
      const installAns = await rl.question("Install dependencies: yes/no (no): ")
      const iClean = installAns.trim().toLowerCase()
      install = iClean === "y" || iClean === "yes"

      // 5. Initialize git
      const gitAns = await rl.question("Initialize git: yes/no (no): ")
      const gClean = gitAns.trim().toLowerCase()
      git = gClean === "y" || gClean === "yes"
    } finally {
      rl.close()
    }
  } else {
    // Non-interactive mode
    if (!projectName) {
      console.error("\x1b[31m✖\x1b[0m \x1b[1mUsage:\x1b[0m create-boronix <app-name> [options]")
      process.exit(1)
    }

    const checkPath = path.resolve(projectName)
    if (existsSync(checkPath)) {
      console.error(`\x1b[31m✖\x1b[0m \x1b[1mError:\x1b[0m Target directory already exists: ${projectName}`)
      process.exit(1)
    }
  }

  // Print summary card
  console.log(`  \x1b[32m✔\x1b[0m \x1b[90mproject\x1b[0m   \x1b[1m${projectName}\x1b[0m`)
  console.log(`  \x1b[32m✔\x1b[0m \x1b[90mtemplate\x1b[0m  \x1b[1m${template}\x1b[0m`)
  console.log(`  \x1b[32m✔\x1b[0m \x1b[90mruntime\x1b[0m   \x1b[1m${runtime}\x1b[0m\n`)

  const targetDir = path.resolve(projectName)
  const templateDir = path.join(packageRoot, "src", "templates", template)

  if (!existsSync(templateDir)) {
    console.error(`\x1b[31m✖\x1b[0m \x1b[1mError:\x1b[0m Template '${template}' not found at ${templateDir}`)
    process.exit(1)
  }

  // Copy template files
  mkdirSync(targetDir, { recursive: true })
  cpSync(templateDir, targetDir, { recursive: true })

  // Adjust package.json
  const pkgPath = path.join(targetDir, "package.json")
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    pkg.name = path.basename(projectName)
    
    // Ensure scripts match exact requirement
    pkg.scripts = {
      "dev": "boronix dev",
      "build": "boronix build",
      "start": "boronix start",
      "doctor": "boronix doctor"
    }

    // Set boronix version to ^0.2.7
    if (pkg.dependencies) {
      if (pkg.dependencies.boronix) delete pkg.dependencies.boronix
      if (pkg.dependencies["@boronix-ts/boronix"]) delete pkg.dependencies["@boronix-ts/boronix"]
      pkg.dependencies["boronix"] = "^0.2.7"
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8")
  }

  // Adjust config runtime
  const configPath = path.join(targetDir, "boronix.config.ts")
  if (existsSync(configPath)) {
    let configContent = readFileSync(configPath, "utf8")
    configContent = configContent.replace(/runtime:\s*["'](?:bun|node|deno)["']/, `runtime: "${runtime}"`)
    writeFileSync(configPath, configContent, "utf8")
  }

  console.log(`\x1b[32m✔\x1b[0m created project`)

  // Git init
  if (git) {
    try {
      execSync("git init", { cwd: targetDir, stdio: "ignore" })
      console.log(`\x1b[32m✔\x1b[0m initialized git repository`)
    } catch {}
  }

  // Install dependencies
  let installFailed = false
  if (install) {
    try {
      const pm = runtime === "bun" ? "bun" : "npm"
      execSync(`${pm} install`, { cwd: targetDir, stdio: "ignore" })
    } catch (err) {
      installFailed = true
    }
  }

  console.log("")

  if (installFailed) {
    console.log(`\x1b[33m⚠\x1b[0m dependency install failed\n`)
    console.log(`Hint:`)
    console.log(`  Run \`bun install\` manually.\n`)
  }

  console.log("\x1b[1mNext steps\x1b[0m")
  console.log(`  \x1b[38;5;208m➜\x1b[0m cd ${projectName}`)
  if (!install || installFailed) {
    const pm = runtime === "bun" ? "bun" : "npm"
    console.log(`  \x1b[38;5;208m➜\x1b[0m ${pm} install`)
  }
  const pmRun = runtime === "bun" ? "bun" : "npm"
  console.log(`  \x1b[38;5;208m➜\x1b[0m ${pmRun} run dev\n`)
  console.log("\x1b[1mThen open\x1b[0m")
  console.log(`  \x1b[38;5;208m➜\x1b[0m http://localhost:3000`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

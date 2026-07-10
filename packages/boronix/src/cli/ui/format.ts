import { symbols } from "./symbols"
import { colors } from "./colors"

export function formatRootHelp(): string {
  return `${colors.bold("Boronix")}

${colors.bold("Usage")}
  boronix <command> [options]

${colors.bold("Commands")}
  dev       Start development server
  build     Build production manifest
  start     Start production server
  info      Print environment information
  doctor    Check project health
  typegen   Generate route types
  routes    List all project routes as a tree
  inspect   Inspect matched files for a specific URL route
  db generate
  db migrate
  db push
  db seed

${colors.bold("Options")}
  -h, --help       Show help
  -v, --version    Show version`
}

export function formatCommandHelp(command: string): string {
  let usage = `boronix ${command} [options]`
  let options = ""

  if (command === "dev") {
    options = `  --root <dir>        Project root
  --runtime <name>    bun | node
  -p, --port <port>   Server port
  -H, --host <host>   Server host
  -o, --open          Open the browser automatically
  --quiet             Startup and errors output only
  --verbose           Detailed output with static asset requests
  --no-reload         Disable browser auto-refresh and file watcher
  --debug-watch       Print detailed file watch diagnostics
  --plain             Disable colors, unicode, and spinner
  --no-color          Disable colors`
  } else if (command === "start") {
    options = `  --root <dir>        Project root
  --runtime <name>    bun | node
  -p, --port <port>   Server port
  -H, --host <host>   Server host
  --quiet             Startup and errors output only
  --verbose           Detailed request logs
  --plain             Disable colors, unicode, and spinner
  --no-color          Disable colors`
  } else if (command === "build") {
    options = `  --root <dir>        Project root
  --runtime <name>    bun | node
  --plain             Disable colors, unicode, and spinner
  --no-color          Disable colors`
  } else if (command === "routes") {
    options = `  --root <dir>        Project root
  --json              Output routes summary in machine JSON format
  --full              Output full absolute paths of matched source modules
  --flat              Output a flat route list without tree structures
  --plain             Disable styling and colors
  --no-color          Disable colors`
  } else if (command === "db") {
    usage = `boronix db generate
  boronix db migrate
  boronix db push
  boronix db seed`
    options = `  --root <dir>        Project root
  --plain             Disable colors, unicode, and spinner
  --no-color          Disable colors`
  } else if (command === "doctor") {
    options = `  --root <dir>        Project root
  --production        Run checks for production environment validation
  --json              Output diagnostics in machine-readable JSON format
  --plain             Disable colors, unicode, and spinner
  --no-color          Disable colors`
  } else {
    options = `  --root <dir>        Project root
  --plain             Disable colors, unicode, and spinner
  --no-color          Disable colors`
  }

  return `${colors.bold("Usage")}
  ${usage}

${colors.bold("Options")}
${options}`
}

export function formatHeader(commandName: string, isPlainMode: boolean): string {
  if (isPlainMode) {
    return `Boronix ${commandName}`
  }
  return `${colors.brand(symbols.header())} ${colors.bold(`Boronix ${commandName}`)}`
}

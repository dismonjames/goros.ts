import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export type BoronixErrorOptions = {
  code?: string | undefined
  file?: string | undefined
  expected?: string | undefined
  found?: string | undefined
  hint?: string | undefined
  cause?: unknown
}

export class BoronixError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BoronixError"
  }
}

export class BoronixUserError extends BoronixError {
  readonly code?: string | undefined
  readonly file?: string | undefined
  readonly expected?: string | undefined
  readonly found?: string | undefined
  readonly hint?: string | undefined

  constructor(message: string, options: BoronixErrorOptions = {}) {
    super(message)
    this.name = "BoronixUserError"
    this.code = options.code
    this.file = options.file
    this.expected = options.expected
    this.found = options.found
    this.hint = options.hint
    this.cause = options.cause
  }

  get details(): { file?: string | undefined; hint?: string | undefined } {
    return {
      file: this.file,
      hint: this.hint
    }
  }
}

export type BoronixErrorPhase =
  | "config"
  | "middleware"
  | "layout"
  | "page-loader"
  | "page-render"
  | "api"
  | "action"
  | "static"
  | "router"
  | "unknown"

export type BoronixDiagnostic = {
  phase: BoronixErrorPhase
  route?: string | undefined
  pattern?: string | undefined
  file?: string | undefined
  action?: string | undefined
  method?: string | undefined
  status?: number | undefined
  message: string
  stack?: string | undefined
  codeFrame?: string | undefined
  hints?: string[] | undefined
}

export function parseStackTrace(stack: string, rootDir: string): { file?: string | undefined; line?: number | undefined; column?: number | undefined; cleanStack: string } {
  const lines = stack.split("\n")
  const frames: string[] = []
  let firstUserFrame: { file: string; line: number; column: number } | undefined

  for (const line of lines) {
    const match = line.match(/(?:at\s+)?(?:(.*?)\s+\()?([^()\s]+):(\d+):(\d+)\)?$/)
    if (match) {
      let filePath = match[2]!
      const lineNum = parseInt(match[3]!, 10)
      const colNum = parseInt(match[4]!, 10)

      if (filePath.startsWith("file://")) {
        try {
          filePath = fileURLToPath(filePath)
        } catch {
          filePath = filePath.replace(/^file:\/\//, "")
        }
      }

      let relativePath = filePath
      if (path.isAbsolute(filePath)) {
        relativePath = path.relative(rootDir, filePath)
      }

      const isInternal = relativePath.includes("node_modules") || relativePath.includes("packages/boronix")
      const isUser = !isInternal && (relativePath.startsWith("app") || relativePath.startsWith("./app") || !relativePath.startsWith(".."))

      if (isUser && !firstUserFrame) {
        firstUserFrame = { file: relativePath, line: lineNum, column: colNum }
      }

      const cleanLine = line.replace(match[2]!, relativePath)
      frames.push(cleanLine)
    } else {
      frames.push(line)
    }
  }

  return {
    file: firstUserFrame?.file,
    line: firstUserFrame?.line,
    column: firstUserFrame?.column,
    cleanStack: frames.join("\n")
  }
}

export function generateCodeFrame(filePath: string, line: number, column?: number): string {
  if (!existsSync(filePath)) return ""
  try {
    const content = readFileSync(filePath, "utf8")
    const lines = content.split(/\r?\n/)
    const start = Math.max(0, line - 3)
    const end = Math.min(lines.length, line + 2)

    const maxLength = String(end).length
    const frameLines: string[] = []

    for (let i = start; i < end; i++) {
      const currentLineNum = i + 1
      const isTarget = currentLineNum === line
      const lineContent = lines[i]!
      
      const prefix = isTarget 
        ? `> ${String(currentLineNum).padStart(maxLength)} | `
        : `  ${String(currentLineNum).padStart(maxLength)} | `
        
      frameLines.push(`${prefix}${lineContent}`)

      if (isTarget && column !== undefined && column > 0) {
        const caretPrefix = `    | `
        const caretPadding = " ".repeat(column - 1)
        frameLines.push(`${caretPrefix}${caretPadding}^`)
      }
    }
    return frameLines.join("\n")
  } catch {
    return ""
  }
}

export function diagnoseError(
  error: unknown,
  root: string,
  defaultPhase: BoronixErrorPhase = "unknown"
): BoronixDiagnostic {
  let phase: BoronixErrorPhase = defaultPhase
  let message = "Unknown error"
  let stack = ""
  let file: string | undefined
  let expected: string | undefined
  let found: string | undefined
  let hint: string | undefined
  let hints: string[] = []

  if (error && typeof error === "object") {
    const errObj = error as any
    if (errObj.phase) {
      phase = errObj.phase
    }
    if (errObj.code) {
      hints.push(`Code: ${errObj.code}`)
    }
  }

  if (error instanceof BoronixUserError) {
    message = error.message
    file = error.file
    expected = error.expected
    found = error.found
    hint = error.hint
    if (error.stack) {
      stack = error.stack
    }
  } else if (error instanceof Error) {
    message = error.message
    if (error.stack) {
      stack = error.stack
    }
  } else {
    message = String(error)
  }

  let cleanStack = stack
  let codeFrame = ""
  if (stack) {
    const parsed = parseStackTrace(stack, root)
    cleanStack = parsed.cleanStack
    if (!file && parsed.file) {
      file = parsed.file
    }
    if (file && parsed.line !== undefined) {
      const fullPath = path.isAbsolute(file) ? file : path.resolve(root, file)
      codeFrame = generateCodeFrame(fullPath, parsed.line, parsed.column)
    }
  }

  if (expected || found) {
    let shapeHint = ""
    if (expected) shapeHint += `Expected export:\n${expected}\n`
    if (found) shapeHint += `Found:\n${found}`
    if (shapeHint) hints.push(shapeHint)
  }

  if (hint) {
    hints.push(hint)
  }

  if (message.includes("Cannot read properties of undefined") || message.includes("is not defined")) {
    hints.push("Check if the variable/property is defined before accessing it.")
  }

  return {
    phase,
    file: file || undefined,
    message,
    stack: cleanStack || undefined,
    codeFrame: codeFrame || undefined,
    hints: hints.length > 0 ? hints : undefined
  }
}

export function formatBoronixError(error: unknown): string {
  if (error instanceof BoronixUserError) {
    const lines = [`Boronix error: ${error.message}`]
    if (error.file) lines.push("", "File:", `  ${error.file}`)
    if (error.hint) lines.push("", "Hint:", `  ${error.hint}`)
    return lines.join("\n")
  }
  if (error instanceof Error) {
    return `Boronix error: ${error.message}`
  }
  return `Boronix error: ${String(error)}`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function renderDevErrorPage(diagnostic: BoronixDiagnostic): string {
  const formattedCodeFrame = diagnostic.codeFrame
    ? escapeHtml(diagnostic.codeFrame)
        .split("\n")
        .map(line => {
          const parts = line.split("|")
          if (parts.length > 1) {
            const prefix = parts[0] ?? ""
            const code = parts.slice(1).join("|")
            if (prefix.includes("&gt;")) {
              const styledPrefix = prefix
                .replace(/&gt;/, '<span class="caret-indicator">&gt;</span>')
                .replace(/(\d+)/, '<span class="active-line-num">$1</span>')
              const styledCode = code
                .replace(/\^/g, '<span class="caret-pointer">^</span>')
                .replace(/\b(const|let|var|function|return|import|export|default|async|await|from|class|extends)\b/g, '<span class="keyword">$1</span>')
              return `${styledPrefix}|${styledCode}`
            } else {
              const styledPrefix = prefix
                .replace(/(\d+)/, '<span class="line-number">$1</span>')
              const styledCode = code
                .replace(/\^/g, '<span class="caret-pointer">^</span>')
                .replace(/\b(const|let|var|function|return|import|export|default|async|await|from|class|extends)\b/g, '<span class="keyword">$1</span>')
              return `${styledPrefix}|${styledCode}`
            }
          }
          return line.replace(/\^/g, '<span class="caret-pointer">^</span>')
        })
        .join("\n")
    : ""

  const codeFrameHtml = diagnostic.codeFrame
    ? `<div class="section-title">Source</div>
       <div class="source-box">
         <div class="source-header">
           <span class="source-path">${escapeHtml(diagnostic.file ?? "source_code")}</span>
           <span class="source-link">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
           </span>
         </div>
         <pre><code>${formattedCodeFrame}</code></pre>
       </div>`
    : ""

  const diagCards: string[] = []
  if (diagnostic.route) {
    diagCards.push(`
      <div class="diagnostic-card">
        <span class="diag-label">Route Path</span>
        <span class="diag-val">${escapeHtml(diagnostic.route)}</span>
      </div>
    `)
  }
  if (diagnostic.pattern) {
    diagCards.push(`
      <div class="diagnostic-card">
        <span class="diag-label">Route Pattern</span>
        <span class="diag-val">${escapeHtml(diagnostic.pattern)}</span>
      </div>
    `)
  }
  diagCards.push(`
    <div class="diagnostic-card">
      <span class="diag-label">Execution Phase</span>
      <span class="diag-val badge">${escapeHtml(diagnostic.phase)}</span>
    </div>
  `)
  if (diagnostic.action) {
    diagCards.push(`
      <div class="diagnostic-card">
        <span class="diag-label">Mapped Action</span>
        <span class="diag-val">${escapeHtml(diagnostic.action)}</span>
      </div>
    `)
  }

  const diagnosticGridHtml = diagCards.length > 0
    ? `<div class="section-title">Diagnostics</div>
       <div class="diagnostic-grid">
         ${diagCards.join("")}
       </div>`
    : ""

  const stackHtml = diagnostic.stack
    ? `<div class="section-title">Call Stack</div>
       <div class="source-box">
         <div class="source-header" style="border-bottom: none;">
           <span class="source-path">Stack Trace</span>
         </div>
         <div class="stack-box">
           <pre class="stack-pre"><code>${escapeHtml(diagnostic.stack)
             .replace(/(at\s+\S+\s+)\((app\/[^\)]+)\)/g, '$1(<span class="user-file">$2</span>)')
             .replace(/(at\s+)\((app\/[^\)]+)\)/g, '$1(<span class="user-file">$2</span>)')}</code></pre>
         </div>
       </div>`
    : ""

  const hintsList = (diagnostic.hints ?? []).map(h => `<li>${escapeHtml(h)}</li>`).join("")
  const hintsHtml = (diagnostic.hints && diagnostic.hints.length > 0)
    ? `<div class="hints-section">
        <div class="hints-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line></svg>
          <h3>Suggestions & Hints</h3>
        </div>
        <ul>${hintsList}</ul>
       </div>`
    : ""

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Boronix Dev Error</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #030303;
      background-image: 
        radial-gradient(circle at 50% 30%, rgba(239, 68, 68, 0.08), transparent 60%),
        radial-gradient(circle at 10% 80%, rgba(56, 189, 248, 0.05), transparent 50%);
      color: #e4e4e7;
      margin: 0;
      padding: 40px 20px;
      min-height: 100vh;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .error-modal {
      width: 100%;
      max-width: 900px;
      background: #0c0c0e;
      border: 1px solid #1e1e24;
      border-top: 3px solid #ef4444;
      border-radius: 12px;
      box-shadow: 0 40px 80px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.1) inset;
      padding: 30px;
      box-sizing: border-box;
    }
    .modal-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .nav-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .nav-arrows {
      display: flex;
      gap: 4px;
    }
    .arrow-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 5px;
      background: #141416;
      border: 1px solid #222227;
      color: #44444f;
      cursor: pointer;
    }
    .arrow-btn.active {
      color: #88888f;
    }
    .error-count {
      font-size: 0.8rem;
      color: #6e6e77;
      font-weight: 500;
    }
    .close-btn {
      background: none;
      border: none;
      color: #71717a;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      transition: color 0.15s ease;
    }
    .close-btn:hover {
      color: #ffffff;
    }
    .error-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 14px 0;
      letter-spacing: -0.01em;
    }
    .error-banner {
      background: rgba(239, 68, 68, 0.08);
      border-left: 3px solid #ef4444;
      padding: 14px 18px;
      border-radius: 6px;
      color: #fca5a5;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.5;
      margin-bottom: 24px;
      word-break: break-word;
    }
    .section-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #ffffff;
      margin: 24px 0 10px 0;
    }
    .source-box {
      border: 1px solid #1e1e24;
      border-radius: 8px;
      overflow: hidden;
      background: #050507;
    }
    .source-header {
      background: #0e0e11;
      padding: 8px 16px;
      border-bottom: 1px solid #1e1e24;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .source-path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: #a1a1aa;
    }
    .source-link {
      color: #71717a;
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    .source-link:hover {
      color: #fff;
    }
    pre {
      margin: 0;
      padding: 16px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      line-height: 1.6;
      color: #e4e4e7;
    }
    .line-number {
      color: #52525b;
    }
    .active-line-num {
      color: #ef4444;
      font-weight: 600;
    }
    .caret-indicator {
      color: #ef4444;
      font-weight: 600;
    }
    .caret-pointer {
      color: #ef4444;
      font-weight: 700;
    }
    .keyword {
      color: #38bdf8;
    }
    .string {
      color: #34d399;
    }
    .diagnostic-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 8px;
    }
    .diagnostic-card {
      background: #0e0e11;
      border: 1px solid #1e1e24;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .diag-label {
      color: #71717a;
      font-size: 0.65rem;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
      display: block;
      margin-bottom: 2px;
    }
    .diag-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: #e4e4e7;
      word-break: break-all;
    }
    .diag-val.badge {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.15);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    .stack-box {
      background: #050507;
      border: 1px solid #1e1e24;
      border-radius: 8px;
      padding: 14px 18px;
      max-height: 200px;
      overflow-y: auto;
    }
    .stack-pre {
      margin: 0;
      padding: 0;
      font-size: 0.8rem;
      line-height: 1.7;
      color: #71717a;
    }
    .user-file {
      color: #ef4444;
      font-weight: 500;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .hints-section {
      background: #0e0e11;
      border: 1px solid #1e1e24;
      border-radius: 8px;
      padding: 14px 18px;
      margin-top: 20px;
    }
    .hints-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #38bdf8;
      margin-bottom: 10px;
    }
    .hints-header h3 {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .hints-section ul {
      margin: 0;
      padding-left: 20px;
      color: #a1a1aa;
      font-size: 0.85rem;
    }
    .hints-section li {
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
  <div class="error-modal">
    <div class="modal-nav">
      <div class="nav-left">
        <div class="nav-arrows">
          <button class="arrow-btn" disabled>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <button class="arrow-btn" disabled>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
        <span class="error-count">1 of 1 error</span>
      </div>
      <button class="close-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <h2 class="error-title">Unhandled Runtime Error</h2>
    <div class="error-banner">
      ${escapeHtml(diagnostic.message)}
    </div>

    ${codeFrameHtml}
    ${diagnosticGridHtml}
    ${stackHtml}
    ${hintsHtml}
  </div>
</body>
</html>
  `
}

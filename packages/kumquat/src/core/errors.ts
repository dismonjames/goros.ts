export class KumquatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KumquatError"
  }
}

export class KumquatUserError extends KumquatError {
  constructor(message: string, readonly details: { file?: string; hint?: string } = {}) {
    super(message)
    this.name = "KumquatUserError"
  }
}

export function formatKumquatError(error: unknown): string {
  if (error instanceof KumquatUserError) {
    const lines = [`Kumquat error: ${error.message}`]

    if (error.details.file) {
      lines.push("", "File:", `  ${error.details.file}`)
    }

    if (error.details.hint) {
      lines.push("", "Hint:", `  ${error.details.hint}`)
    }

    return lines.join("\n")
  }

  if (error instanceof Error) {
    return `Kumquat error: ${error.message}`
  }

  return `Kumquat error: ${String(error)}`
}

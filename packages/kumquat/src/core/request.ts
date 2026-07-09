export type BodyReader = {
  json<T = unknown>(): Promise<T>
  text(): Promise<string>
  form(): Promise<FormData>
}

export function createBodyReader(req: Request): BodyReader {
  return {
    json: async <T = unknown>() => req.json() as Promise<T>,
    text: async () => req.text(),
    form: async () => req.formData()
  }
}

export async function readFormData(req: Request): Promise<FormData> {
  try {
    return await req.clone().formData()
  } catch {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType) {
      return new FormData()
    }
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      throw new Error("Invalid form request. Expected multipart/form-data or application/x-www-form-urlencoded.")
    }

    const params = new URLSearchParams(await req.text())
    const form = new FormData()
    for (const [name, value] of params.entries()) {
      form.set(name, value)
    }
    return form
  }
}

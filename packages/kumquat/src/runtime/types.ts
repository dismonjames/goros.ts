export type RuntimeServer = {
  serve(options: {
    port: number
    host: string
    fetch(req: Request): Promise<Response> | Response
  }): unknown
}

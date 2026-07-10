# Health Checks in Boronix

Enable health monitoring by configuring the optional health endpoint.

## Configuration

Add the `health` block in `boronix.config.ts`:

```ts
export default defineConfig({
  health: {
    enabled: true,
    path: "/health"
  }
})
```

The default is `disabled`.

## Response Format

```http
GET /health
```

Returns `200 OK` with JSON:

```json
{
  "status": "ok",
  "framework": "boronix",
  "version": "0.6.0"
}
```

## Route Conflict Check

If the health check endpoint path conflicts with any page or API route in your application, `boronix build` will fail with a `KQ_HEALTH_ROUTE_CONFLICT` error.
Additionally, the health route check ensures it does not override any user routes silently.

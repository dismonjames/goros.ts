# inspect Command

The `inspect` command resolves a specific request URL route, extracting matched dynamic parameters and all physical route capsule files (pages, loaders, actions, layouts).

## Usage

```bash
boronix inspect <pathname> [options]
```

## Options

- `--method <verb>`: Inspect with a specific HTTP method (e.g. POST, GET).
- `--json`: Output only raw parseable JSON representing the matched route details.
- `--plain`: Disable colors and Unicode symbols.
- `--no-color`: Disable terminal colors.

## Examples

### Inspecting the Root Route

```bash
boronix inspect / --json
```

The result points to `app/routes/page.html` and, when present, `app/routes/page.ts`.

### Matching an Action
```bash
boronix inspect "/login?/login"
```
Outputs:
```txt
◆ Boronix inspect

  ◆ /login?/login
  │
  ├─ matched
  │  └─ /login
  │
  ├─ request
  │  ├─ method  POST
  │  └─ kind    action
  │
  ├─ action
  │  ├─ name    login
  │  └─ file    app/routes/login/actions.ts
  │
  ├─ files
  │  ├─ page    app/routes/login/page.html
  │  ├─ loader  app/routes/login/page.ts
  │  └─ action  app/routes/login/actions.ts
  │
  └─ layouts
     └─ app/layout.html

✔ route resolved
```

### JSON Mode
```bash
boronix inspect /login --json
```
Outputs:
```json
{
  "success": true,
  "routePath": "/login",
  "matched": "/login",
  "request": {
    "method": "GET",
    "kind": "page"
  },
  "files": {
    "page": "app/routes/login/page.html",
    "loader": "app/routes/login/page.ts"
  },
  "layouts": [
    "app/layout.html"
  ]
}
```

## Error Diagnostics
If the route, action, or API does not exist, `boronix inspect` exits with code `1` and prints the error code:
- `KQ_ROUTE_NOT_FOUND`
- `KQ_ACTION_NOT_FOUND`
- `KQ_API_NOT_FOUND`

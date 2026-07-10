# Routing

Routes are generated from `app/routes`.

- `page.html` maps to `/`.
- `login/page.html` maps to `/login`.
- `exercises/[id]/page.html` maps to `/exercises/:id`.
- `exercises/api.ts` maps to `/api/exercises`.

Static routes are matched first, dynamic routes second, catch-all routes last.

`home/page.html` is not special: it maps to `/home`.

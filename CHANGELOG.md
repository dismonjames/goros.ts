# Changelog

All notable changes to this project will be documented in this file.

## v0.6.0 - Dev Server Speed & HMR-lite

- Added stable development file watching.
- Added template and public asset reloads without process restart.
- Added isolated child-process restarts for server module changes.
- Added automatic browser refresh through Server-Sent Events.
- Added route add/remove/rename detection.
- Added public asset reload handling.
- Added restart recovery after source and config errors.
- Added watch event debouncing and ignore rules.
- Added reload latency logs and watch diagnostics.
- Added Bun and Node development runtime coverage.

## v0.5.0 - Production Build Hardening

- Added production environment validation.
- Hardened session secret handling.
- Removed duplicate development secret warnings during builds.
- Added validated build manifests.
- Added atomic build output writes.
- Hardened `boronix start`.
- Added production-safe error responses.
- Added request IDs.
- Added static cache and security headers.
- Added graceful shutdown handling.
- Added optional health endpoint.
- Added `boronix doctor --production`.
- Added production smoke tests and deployment documentation.

## v0.4.3 - Runtime Error Overlay Fix

- Routed development runtime errors through the polished Boronix dev overlay.
- Added coverage to ensure thrown page errors render the refined overlay HTML.

## v0.4.2 - SQLite Runtime Guard

- Rejected `create-boronix --db sqlite --runtime node` with a clear runtime support error.
- Documented that SQLite requires Bun because the template uses `bun:sqlite`.
- Clarified that Postgres templates work with Bun or Node.

## v0.4.1 - Dev Error Overlay Polish

- Refined the development error overlay with a more polished dark modal layout.
- Added subtle SVG iconography for the runtime error headline, source panel, diagnostics, and error message banner.
- Improved source frame readability, diagnostic cards, spacing, borders, shadows, and mobile responsiveness.

## v0.4.0 - Database DX With Drizzle

- Added `create-boronix --db none|sqlite|postgres`.
- Added SQLite and Postgres Drizzle templates with `app/db/schema.ts`, `client.ts`, `seed.ts`, `drizzle.config.ts`, and `.env.example`.
- Added generated `/notes` CRUD route for DB templates.
- Added `boronix db generate`, `boronix db migrate`, `boronix db push`, and `boronix db seed` wrappers.
- Added database checks to `boronix doctor` when `drizzle.config.ts` exists.
- Added `examples/notes-sqlite` and database docs/tutorial.
- Bumped packages and generated app dependency to `0.4.0`.

## v0.3.0 - Developer Experience Core

- Added rich, visual Dev Error Page HTML rendering for development mode.
- Tagged and determined error phases (config, middleware, layout, page-loader, page-render, api, action, static, router, unknown).
- Implemented robust stack trace cleaning (hiding internal packages/node_modules frames, prioritizing user code).
- Integrated exact column caret pointing and source file code frame rendering in errors.
- Added file convention routes: `app/not-found.html` and `app/error.html` for local and global error boundary resolution.
- Redefined `notFound()` to render HTML boundaries on page requests, returning JSON on API requests.
- Upgraded `boronix inspect` to support action URL parsing, `--method`, and `--json` parseable output.
- Enhanced Form/Action DX with precise mismatch, shape, wrapping, and return type error diagnostics.
- Redesigned typegen (`boronix typegen`) to produce `.boronix/types/routes.d.ts` featuring `BoronixRoute` union, `BoronixRouteParams`, and `RouteParams` mapping.
- Updated templates to include global `error.html` and `not-found.html` configurations.

## v0.2.7 - CI Publish Workflow

- Added GitHub Actions publish workflow triggered on version tags.
- Added tag-version guard: tag must match package.json version.
- Added release:check + smoke:pack gates before npm publish.
- Publish order: boronix first, create-boronix second.
- Post-publish verification step via `npm view`.
- Updated README with npm badges and correct install instructions.
- `NPM_TOKEN` automation secret set in GitHub repository.

## v0.2.6 - Rebrand to Boronix

- Rebranded from Goros to Boronix (final brand name).
- Renamed package `goros` to `boronix`.
- Renamed creator package `create-goros` to `create-boronix`.
- Renamed CLI command `goros` to `boronix`.
- Renamed config file to `boronix.config.ts`.
- Renamed build output directory to `.boronix`.
- Updated all docs, examples, templates, package metadata, and test fixtures.
- Verified npm tarball packaging and local install flow.
- Confirmed `boronix` and `create-boronix` are available on npm registry.

## v0.2.5 - Rebrand to Boronix

- Rebranded Kumquat.ts to Boronix.
- Renamed package `kumquat` to `boronix`.
- Renamed creator package `create-kumquat` to `create-boronix`.
- Renamed CLI command `kumquat` to `boronix`.
- Renamed config file to `boronix.config.ts`.
- Renamed build output to `.boronix`.
- Updated docs, examples, package metadata, and smoke tests.
- Verified npm tarball packaging and local install flow.

Note: Boronix was formerly developed as Kumquat.ts during early alpha.

## v0.2.4 - Publish Readiness

- Stabilized package metadata for npm registry standard compliance.
- Added release check script (`scripts/release-check.ts`).
- Added tarball smoke test script (`scripts/smoke-pack.ts`).
- Included README.md and LICENSE inside package tarballs.
- Documented package publishing process.
- Implemented non-interactive scaffolding option flags for `create-boronix`.

## v0.2.3-cli-visual

- Added visual CLI experience with startup cards, request logging, and ASCII trees.
- Added routes tree visualization and inspect route utilities.
- Styled custom error outputs and hint helpers.
- Added network LAN IP detection.

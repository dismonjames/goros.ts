# Changelog

All notable changes to this project will be documented in this file.

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

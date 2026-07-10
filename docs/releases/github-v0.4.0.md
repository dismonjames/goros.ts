# Release v0.4.0 - Database DX With Drizzle

## Highlights

- Added Drizzle database scaffolding to `create-boronix`.
- Added SQLite and Postgres templates with `app/db` convention.
- Added `boronix db generate`, `migrate`, `push`, and `seed`.
- Added generated `/notes` CRUD route for DB apps.
- Added `examples/notes-sqlite`.
- Added DB-aware `boronix doctor` checks.
- Added database docs and tutorial.

## Notes

Boronix does not ship its own ORM or migration engine. Database operations are delegated to Drizzle and Drizzle Kit.

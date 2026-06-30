# Alembic Migrations

This directory contains the database migrations for the VirtAI project.

## Legacy Timeline & Migration Hygiene

### The 0618aecd13e3 / e4 Incident
Historically, the migration `0618aecd13e3` was tampered with after deployment to fix a uniqueness constraint issue. This was a violation of migration safety (P0 risk), as modifying already-deployed migrations breaks the migration chain for existing production databases.

To rectify this, the original `0618aecd13e3` migration was restored to its exact original state (including the `DELETE` and `create_unique_constraint` SQL). A new migration was subsequently generated to correctly enforce the `sha256` unique constraints without rewriting history.

### Migration Rules
- **NEVER** modify a migration file after it has been merged and deployed to an environment.
- Always generate a **NEW** migration (`alembic revision -m "description"`) for schema changes or fixes to existing constraints.
- If a migration is completely broken, you must create a new migration to revert it, or fix the state moving forward.

## Running Migrations

To apply all pending migrations:
```bash
alembic upgrade head
```

To create a new migration:
```bash
alembic revision --autogenerate -m "Description of change"
```

## Legacy Timeline

### The 001 to 003 Legacy Migrations
The first three migrations (`001_initial_schema.py`, `002_add_hnsw_index.py`, `003_fix_vector_dimension.py`) form the baseline schema for the VirtAI backend.
These migrations were not squashed into a single baseline migration to preserve compatibility with existing production databases that already have this migration history applied. Do not modify these legacy migrations, as they represent the chronological evolution of the base schema.

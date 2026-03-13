# Migration Plan: yarn→pnpm + tsx dev + internal package pattern

## Status Tracker

| Phase | Description | Status | Branch/PR |
|-------|-------------|--------|-----------|
| 1 | yarn → pnpm | DONE | migrate-pnpm-shared-tsx |
| 2 | tsx for API dev | DONE | migrate-pnpm-shared-tsx |
| 3 | internal package pattern | DONE | migrate-pnpm-shared-tsx |

---

## Current State (after Phase 2)

- pnpm workspaces + Turbo, 3 workspaces (`api`, `web`, `e2e`)
- API dev uses `tsx watch` (hot reload), production still `tsc` build + `node dist/...`
- Web depends on `"api": "workspace:*"`, resolves to `api/dist/src/lib/index.js`
- `pnpm build` (turbo) builds api first (tsc), then web (vite) — required because web resolves `from "api"` to compiled `dist/`
- 27 type-only imports + 1 runtime value (`languages`, but web defines its own copy)
- Effectively zero runtime coupling between api→web

## Decisions

- **No shared package**: tRPC already provides end-to-end type safety. All web→api imports are type-only. A `@catalogi/shared` package would add indirection without real benefit.
- **Internal package pattern instead**: point api's `main`/`types` to raw `.ts` source so Vite resolves types directly — no `tsc` build needed before `web:dev`.

---

## Phase 1: yarn → pnpm (DONE)

Swapped package manager. Dockerfiles, CI, hooks, docs all updated.

---

## Phase 2: tsx for API dev (DONE)

- `dev` script: `dotenv -e ../.env -- tsx watch src/entrypoints/start-api.ts`
- `db:seed` script: `dotenv -e ../.env -- tsx scripts/seed.ts`
- tsx added as devDependency
- Production scripts (`start`, `job:*`) unchanged — still `node dist/...`

---

## Phase 3: internal package pattern (PR #3)

### What and why

Ref: https://turborepo.dev/blog/you-might-not-need-typescript-project-references

Currently web resolves `from "api"` to `api/dist/src/lib/index.js` (compiled JS). This means `tsc` must run before web:dev works. With the internal package pattern, api's `main`/`types` point to raw `.ts` source. Vite natively transpiles `.ts` imports from `node_modules` — no build step needed for dev.

**Bundle safety**: web imports from api are almost entirely `import type` (erased at transpile time). The only runtime export is `languages`, which web doesn't import (has its own copy). Vite/Rollup tree-shaking ensures zero api code ends up in the web bundle.

### Changes

#### api/package.json

```
"main": "dist/src/lib/index.js"   → "./src/lib/index.ts"
"types": "dist/src/lib/index.d.ts" → "./src/lib/index.ts"
```

Keep `"files"`, `"build"` script, and everything else unchanged. `tsc` build is still needed for:
- Production Docker builds
- CI type checking
- Any future npm publishing (unlikely, but `"files"` already declares `dist/`)

#### turbo.json

`web:build` must still depend on `api:build` (`"dependsOn": ["^build"]`) — tRPC type inference needs the compiled router. But `web:dev` no longer needs a prior `api:build`.

No turbo.json changes needed (the `"dependsOn": ["^build"]` on `build` is correct, `dev` has no deps).

#### api/src/lib/index.ts

No changes. All exports are already `export type` or re-exports. Vite handles `.ts` resolution natively.

### What does NOT change

- Production runtime: `tsc` build + `node dist/...`
- Dockerfiles: still `RUN pnpm build`, CMD `pnpm start`
- Helm charts, docker-compose: no change
- CI: `pnpm build` still runs tsc
- `api/tsconfig.json`: still emits to `dist/`

### Verification

```bash
# Remove dist to prove web:dev works without it
rm -rf api/dist

# Dev should work (Vite resolves .ts directly)
pnpm dev

# Build should still work (tsc compiles for production)
pnpm build
pnpm typecheck
pnpm test
```

### Risks

- **Editor imports**: VSCode may suggest imports from deep api paths (`api/src/core/...`) instead of `from "api"`. Existing behavior, not new.
- **Accidental runtime imports**: if someone adds a non-type import from api that pulls in heavy code (express, kysely, pg...), it would bloat the web bundle. Mitigated by: all current exports are type-only, and code review catches new runtime exports.
- **`tsc` build still required for `pnpm build`**: the internal package pattern only eliminates the build requirement for dev. Production/CI still builds normally.

---

## Dropped: shared package

Phases 3 and 4 from the original plan proposed a `@catalogi/shared` package for leaf and domain types. This was dropped because:

1. **tRPC already provides type safety** — `TrpcRouterInput`/`TrpcRouterOutput` infer types end-to-end
2. **All web→api imports are type-only** — zero runtime coupling, nothing to "share" at runtime
3. **`api/src/lib/` already acts as the public API contract** — a shared package would just re-export the same types with extra indirection
4. **Single consumer** — only web imports from api. Shared packages make sense with multiple consumers.

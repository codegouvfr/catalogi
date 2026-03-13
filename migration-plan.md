# Migration Plan: yarn→pnpm + tsx dev + shared package

## Status Tracker

| Phase | Description | Status | Branch/PR |
|-------|-------------|--------|-----------|
| 1 | yarn → pnpm | DONE | migrate-pnpm-shared-tsx |
| 2 | tsx for API dev | DONE | migrate-pnpm-shared-tsx |
| 3 | shared package (leaf types) | NOT STARTED | |
| 4 | expand shared (domain types) | NOT STARTED | |

---

## Current State

- Yarn 1.22.22, Turbo 1.12.5, 3 workspaces (`api`, `web`, `e2e`)
- API builds with `tsc` → CommonJS to `dist/`, entry `dist/src/lib/index.js`
- Web depends on `"api": "*"` to get types from compiled `dist/`
- API dev = `yarn build && yarn start` (no watch mode)
- Types shared via `api/src/lib/index.ts` + `api/src/lib/ApiTypes.ts`
- Web imports from `"api"` in ~37 files
- Only runtime value exported from api→web: `languages` array

## Decisions (resolved upfront)

- **Shared package name**: `@catalogi/shared`
- **Zod schemas**: move schemas + runtime values to shared when both api and web need them. Types derived from api-only Zod schemas stay in api.
- **`LocalizedString`**: inline in shared as `Record<Language, string> | string`, drop the `i18nifty` dependency in shared
- **Docker pnpm install**: use corepack (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Turbo**: stays, works fine with pnpm
- **`shamefully-hoist`**: try without first, add if needed
- **e2e package**: does NOT import from `api`, no changes needed for type sharing

## Known limitation

After all phases, **web still depends on `api` for tRPC types** (`TrpcRouter`, `TrpcRouterInput`, `TrpcRouterOutput`). These are inferred from the router and cannot move to shared. `turbo build` must still build api before web for tRPC type inference. Domain type changes no longer require an api rebuild — only router changes do.

---

## Phase 1: yarn → pnpm (PR #1)

Scope: swap package manager. Everything still works the same way after. Dockerfiles, CI, hooks, docs all updated in this PR.

### Files to modify (exhaustive list)

#### Root config

**`package.json`** — change `"packageManager": "yarn@1.22.22"` to `"packageManager": "pnpm@10.x.x"`, remove `"workspaces": ["api", "web", "e2e"]`, update e2e scripts:
```
Current:
  "test:e2e": "yarn --cwd e2e test:e2e",
  "test:e2e:ui": "yarn --cwd e2e test:e2e:ui",
  "test:e2e:headed": "yarn --cwd e2e test:e2e:headed",
Target:
  "test:e2e": "pnpm --filter e2e test:e2e",
  "test:e2e:ui": "pnpm --filter e2e test:e2e:ui",
  "test:e2e:headed": "pnpm --filter e2e test:e2e:headed",
```

**Create `pnpm-workspace.yaml`**:
```yaml
packages:
  - api
  - web
  - e2e
```

**Delete `yarn.lock`**, run `pnpm install` to generate `pnpm-lock.yaml`.

#### api/package.json

Replace `yarn` references in scripts:
```
"dev": "yarn build && yarn start"           → "dev": "pnpm build && pnpm start"
"format": "yarn run _format --write"        → "format": "pnpm run _format --write"
"format:check": "yarn run _format ..."      → "format:check": "pnpm run _format ..."
"db:seed": "yarn build && dotenv ..."       → "db:seed": "pnpm build && dotenv ..."
"start": "yarn db:up ... && dotenv ..."     → "start": "pnpm db:up ... && dotenv ..."
"db:up": "yarn migrate latest"              → "db:up": "pnpm migrate latest"
"dev:db:reset": "yarn dev:db:down && ..."   → "dev:db:reset": "pnpm dev:db:down && ..."
```

#### web/package.json

Replace `yarn` references and update workspace dep:
```
"api": "*"                                  → "api": "workspace:*"
"format": "yarn _format --write"            → "format": "pnpm run _format --write"
"format:check": "yarn _format ..."          → "format:check": "pnpm run _format ..."
```

#### api/update-then-wait.sh

```
yarn job:import-from-inner-identifiers      → pnpm job:import-from-inner-identifiers
yarn job:update                             → pnpm job:update
```

#### lefthook.yml

All `yarn` → `pnpm`:
```
run: yarn format                            → run: pnpm format
run: yarn sync-helm-charts                  → run: pnpm sync-helm-charts
run: yarn bump-helm-chart-version           → run: pnpm bump-helm-chart-version
run: yarn turbo lint                        → run: pnpm turbo lint
run: yarn run commitlint --edit {1}         → run: pnpm run commitlint --edit {1}
run: yarn turbo format:check lint typecheck → run: pnpm turbo format:check lint typecheck
```

#### .github/workflows/ci.yaml

```yaml
# validations job:
- run: yarn install --frozen-lockfile --ignore-scripts
+ run: corepack enable && pnpm install --frozen-lockfile
- run: cd api && yarn build
+ run: cd api && pnpm build
- run: cd api && yarn migrate latest
+ run: cd api && pnpm migrate latest
- run: yarn fullcheck
+ run: pnpm fullcheck

# e2e job:
- run: yarn install --frozen-lockfile --ignore-scripts
+ run: corepack enable && pnpm install --frozen-lockfile
- run: cd e2e && yarn test:e2e
+ run: cd e2e && pnpm test:e2e
```

#### Dockerfile.api

```dockerfile
FROM node:22-alpine as build
RUN apk add --no-cache git openssh-client ca-certificates
+RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
-COPY package.json yarn.lock ./
+COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY api/update-then-wait.sh api/

-RUN yarn install --frozen-lockfile --ignore-scripts
+RUN pnpm install --frozen-lockfile --ignore-scripts

COPY turbo.json ./
COPY api/ api/

WORKDIR /app/api
RUN chmod +x /app/api/update-then-wait.sh
-RUN yarn build
+RUN pnpm build

-CMD ["yarn", "start"]
+CMD ["pnpm", "start"]
```

#### Dockerfile.web

```dockerfile
FROM node:22-alpine as build
+RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
-COPY package.json yarn.lock ./
+COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
COPY web/public/ web/public/
COPY web/index.html web/

-RUN yarn install --frozen-lockfile --ignore-scripts
-RUN cd web && yarn postinstall
+RUN pnpm install --frozen-lockfile --ignore-scripts
+RUN cd web && pnpm postinstall

COPY turbo.json ./
COPY api/ api/
COPY web/src/ web/src/
COPY web/vite.config.ts web/tsconfig.json web/.env.declaration web/

WORKDIR /app
-RUN yarn build
+RUN pnpm build
# ... rest unchanged
```

#### docker-compose.prod.yml

```
command: yarn start                → command: pnpm start
command: yarn update-then-wait 240 → command: pnpm update-then-wait 240
```

#### docker-compose.preprod.yml

Same changes as docker-compose.prod.yml.

#### deployment-examples/docker-compose/docker-compose.yml

```
command: yarn start                → command: pnpm start
command: yarn update-then-wait 240 → command: pnpm update-then-wait 240
```

Note: the customization volume mount path (`/app/api/dist/src/customization`) stays the same — api still builds with tsc in this phase.

#### helm-charts/catalogi/templates/api-deployment.yaml

```
command: ["yarn", "start"]         → command: ["pnpm", "start"]
```

#### helm-charts/catalogi/templates/update-cronjob.yaml

```
command: ["yarn", "update"]        → command: ["pnpm", "update"]
```

#### .vscode/launch.json

All `"runtimeExecutable": "yarn"` → `"runtimeExecutable": "pnpm"`

#### docs/2-getting-started.md

```
- nodejs 22 and yarn               → nodejs 22 and pnpm
yarn install                       → pnpm install
cd api && yarn db:seed             → cd api && pnpm db:seed
yarn dev                           → pnpm dev
```

#### CLAUDE.md

Update all command examples from `yarn` to `pnpm`. Update the "Environment Setup" section.

### Verification

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
# If possible, test Docker builds:
docker build -f Dockerfile.api -t catalogi-api-test .
docker build -f Dockerfile.web -t catalogi-web-test .
```

### Risks
- pnpm strict `node_modules` may break some packages. If `react-dsfr copy-static-assets` or MUI fail, add to `.npmrc`: `shamefully-hoist=true` or `public-hoist-pattern[]=*dsfr*`
- Lockfile diff will be large — review for sanity, not line-by-line

---

## Phase 2: tsx for API dev + production (PR #2)

Scope: replace `tsc && node dist/...` with `tsx`. Unblocks Phase 3 (internal packages need tsx to resolve `.ts` imports at runtime).

### Why tsx before shared package

The internal package pattern (Phase 3) points `main` to raw `.ts` source. `node` can't run `.ts` files. `tsx` can. Without tsx, the API can't import from `@catalogi/shared` at runtime.

### Files to modify

#### api/package.json

Add `tsx` as dependency (needed in production for `pnpm start`):
```json
"dependencies": {
  "tsx": "^4.19.0",
  ...
}
```

Update scripts:
```
"dev": "pnpm build && pnpm start"
→ "dev": "tsx watch src/entrypoints/start-api.ts"

"start": "pnpm db:up --no-outdated-check && dotenv -e ../.env -- node dist/src/entrypoints/start-api.js"
→ "start": "pnpm db:up --no-outdated-check && dotenv -e ../.env -- tsx src/entrypoints/start-api.ts"

"job:import": "dotenv -e ../.env -- node dist/src/entrypoints/import.js"
→ "job:import": "dotenv -e ../.env -- tsx src/entrypoints/import.ts"

"job:import-from-inner-identifiers": "dotenv -e ../.env -- node dist/src/entrypoints/import-from-inner-identifiers.js"
→ "job:import-from-inner-identifiers": "dotenv -e ../.env -- tsx src/entrypoints/import-from-inner-identifiers.ts"

"job:update": "dotenv -e ../.env -- node dist/src/entrypoints/update.js"
→ "job:update": "dotenv -e ../.env -- tsx src/entrypoints/update.ts"

"db:seed": "pnpm build && dotenv -e ../.env -- node dist/scripts/seed.js"
→ "db:seed": "dotenv -e ../.env -- tsx scripts/seed.ts"
```

Keep existing scripts:
```
"build": "tsc && cp -r src/customization dist/src/"  ← KEEP (still needed for web to get compiled tRPC types)
"typecheck": "tsc --noEmit"                           ← KEEP
```

#### Dockerfile.api

The tsc build is still needed because web depends on `api/dist/src/lib/index.js` for tRPC types. But the CMD changes:

```dockerfile
-CMD ["pnpm", "start"]
+CMD ["pnpm", "start"]
```

Actually the `start` script itself changes (tsx instead of node), so CMD stays the same but the underlying script is different. The `RUN pnpm build` step is still needed for the web Docker build (tRPC types).

**But**: evaluate if we can drop `RUN pnpm build` from Dockerfile.api and use tsx directly. If so:

```dockerfile
# Remove: RUN pnpm build
CMD ["pnpm", "start"]
# start script now uses tsx, no build needed
```

Note: the `customization` directory is read from `src/` directly by tsx, no cp needed. But Helm/docker-compose volume mounts point to `/app/api/dist/src/customization/`. These mount paths must change to `/app/api/src/customization/` in:

#### docker-compose deployment-examples customization mount

```
deployment-examples/docker-compose/docker-compose.yml:
- ./customization:/app/api/dist/src/customization
→ ./customization:/app/api/src/customization
```

#### helm-charts/catalogi/templates/api-deployment.yaml

```
mountPath: /app/api/dist/src/customization/ui-config.json
→ mountPath: /app/api/src/customization/ui-config.json

mountPath: /app/api/dist/src/customization/translations/{{ $lang }}.json
→ mountPath: /app/api/src/customization/translations/{{ $lang }}.json
```

Same changes in `helm-charts/catalogi/templates/update-cronjob.yaml`.

#### .vscode/launch.json

Debug configs may need update if they relied on compiled output. The `runtimeExecutable: "pnpm"` + `runtimeArgs: ["dev"]` pattern still works since `pnpm dev` now uses tsx.

### Key context: API entrypoints

All 4 entrypoints follow the same pattern:
```typescript
// api/src/entrypoints/start-api.ts
import "../instrument";
import { startRpcService } from "../rpc";
import { env } from "../env";
startRpcService(env);

// api/src/entrypoints/import.ts, update.ts, import-from-inner-identifiers.ts
// Same pattern: import env + service starter
```

### Key context: customization directory

`api/src/customization/` contains JSON files (ui-config.json, translations/en.json, translations/fr.json). Currently copied to `dist/` during build. With tsx, they're read directly from `src/`. The import paths in code (`../customization/ui-config.json`) resolve from source.

### Verification

```bash
cd api && pnpm dev
# Should start with hot reload, restart on file changes
cd api && pnpm start
# Should start the API (needs .env + running DB)
pnpm build  # tsc build still works (needed for web tRPC types)
pnpm typecheck
pnpm test
```

### Risks
- `__dirname` behavior: tsx preserves `__dirname` for CJS, should be fine
- tsx adds ~5MB to Docker image, ~100ms startup overhead (negligible for long-running server)
- customization volume mount paths change — must coordinate deployment updates

---

## Phase 3: shared package — leaf types (PR #3)

Scope: create `@catalogi/shared` internal package with leaf types only. Small, safe extraction.

### Pattern: Turborepo Internal Packages (no build)

Ref: https://turborepo.dev/blog/you-might-not-need-typescript-project-references

`main` and `types` point to raw `.ts` source. No build step, no `.d.ts`, no tsconfig in shared. Consumers (api via tsx, web via Vite) transpile and typecheck.

**Rules:**
1. **Shared MUST NOT depend on `api` or `web`** — graph: `api → shared ← web`
2. Consumers transpile the internal package (Vite natively, tsx natively)
3. Never publish to npm (`"private": true`)
4. No `tsconfig.json` in shared — consumer's tsconfig governs

### Files to create

#### `pnpm-workspace.yaml` — update

```yaml
packages:
  - api
  - web
  - e2e
  - packages/*
```

#### `packages/shared/package.json`

```json
{
  "name": "@catalogi/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

#### `packages/shared/src/index.ts`

```typescript
export { languages, type Language, type LocalizedString } from "./languages";
export type { Os, RuntimePlatform } from "./platform";
export type { CustomAttributes, AttributeValue, AttributeKind, AttributeDefinition } from "./attributes";
```

#### `packages/shared/src/languages.ts`

Extracted from `api/src/core/ports/GetSoftwareExternalData.ts` lines 17-21:
```typescript
export const languages = ["fr", "en"] as const;
export type Language = (typeof languages)[number];
export type LocalizedString = Partial<Record<Language, string>> & Record<string, string>;
```

Note: `LocalizedString` is currently `LocalizedString_generic<Language>` from `i18nifty`. The actual resolved type is `{ fr: string; en: string } | string` (a union). Check exact definition from i18nifty and inline it. May need `string | Record<Language, string>` or the exact i18nifty shape.

#### `packages/shared/src/platform.ts`

Extracted from `api/src/core/types/SoftwareTypes.ts` lines 16-18:
```typescript
export type Os = "windows" | "linux" | "mac" | "android" | "ios";
export type RuntimePlatform = "cloud" | "mobile" | "desktop";
```

#### `packages/shared/src/attributes.ts`

Extracted from `api/src/core/usecases/readWriteSillData/attributeTypes.ts`:
```typescript
import type { LocalizedString } from "./languages";

export type AttributeKind = "boolean" | "string" | "number" | "date" | "url";

export type AttributeDefinition = {
    name: string;
    kind: AttributeKind;
    label: LocalizedString;
    description?: LocalizedString;
    displayInForm: boolean;
    displayInDetails: boolean;
    displayInCardIcon: "computer" | "france" | "question" | "thumbs-up" | "chat" | "star" | undefined;
    enableFiltering: boolean;
    required: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
};

export type AttributeValue = boolean | string | number | Date | null;
export type CustomAttributes = Record<string, AttributeValue>;
```

### Files to modify

#### api/package.json

Add dep:
```json
"dependencies": {
  "@catalogi/shared": "workspace:*",
  ...
}
```

#### web/package.json

Add dep:
```json
"dependencies": {
  "@catalogi/shared": "workspace:*",
  ...
}
```

#### api/src/core/ports/GetSoftwareExternalData.ts

Change `languages`, `Language`, `LocalizedString` to import from `@catalogi/shared`:
```typescript
// Before:
export const languages = ["fr", "en"] as const;
export type Language = (typeof languages)[number];
export type LocalizedString = LocalizedString_generic<Language>;

// After:
export { languages, type Language, type LocalizedString } from "@catalogi/shared";
```

Or: delete the definitions and update all API internal imports to use `@catalogi/shared`. The re-export approach is safer for Phase 3.

#### api/src/core/usecases/readWriteSillData/attributeTypes.ts

Re-export from shared:
```typescript
export type { AttributeKind, AttributeDefinition, AttributeValue, CustomAttributes } from "@catalogi/shared";
```

#### api/src/core/types/SoftwareTypes.ts

Update `Os`, `RuntimePlatform` imports:
```typescript
import type { Os, RuntimePlatform } from "@catalogi/shared";
// re-export for other api consumers
export type { Os, RuntimePlatform };
```

#### api/src/lib/index.ts

Keep re-exporting everything (backward compat for web during transition):
```typescript
export { type Language, type LocalizedString, languages } from "@catalogi/shared";
export type { Os, RuntimePlatform } from "@catalogi/shared";
// ... keep tRPC types as-is
```

#### Web files (gradual migration)

In this phase, web can keep importing from `"api"` (since api re-exports from shared). Or start migrating individual files. The important thing: it works either way.

For files that only use leaf types, update imports:
```typescript
// Before:
import type { Language } from "api";
// After:
import type { Language } from "@catalogi/shared";
```

Files importing `Language` from `"api"` (update these):
- `web/src/core/bootstrap.ts`
- `web/src/core/usecases/instanceForm/state.ts`
- `web/src/core/usecases/softwareForm/thunks.ts`
- `web/src/core/usecases/softwareForm/state.ts`
- `web/src/ui/pages/redirect/Redirect.tsx`
- `web/src/ui/datetimeUtils.ts`
- `web/src/ui/i18n/i18n.tsx`

Files importing `ApiTypes` stay unchanged for now (Phase 4).

#### Dockerfile.api and Dockerfile.web

Add COPY for shared package:
```dockerfile
COPY packages/shared/package.json packages/shared/
# ... after pnpm install ...
COPY packages/shared/ packages/shared/
```

### Verification

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

### Risks
- `LocalizedString` inlining: api has a `tsafe assert<Equals<>>` checking `LocalizedString` matches `i18nifty`. Must verify shared's inline definition is compatible, or keep the assert in api and import from shared.
- Editor may suggest both `from "@catalogi/shared"` and `from "api"` for moved types during transition.

---

## Phase 4: expand shared — domain types (PR #4, possibly multiple PRs)

Scope: move heavier types to shared. Requires untangling from api internals.

### What moves

**Standalone types (easier):**
- `SimilarSoftware`, `SoftwareVariant`, `Dereferencing`
- `ExternalDataOriginKind` (currently a string union in kysely.database.ts)
- `Source` type

**Schema types (need redefining as standalone):**
- `SchemaPerson`, `SchemaOrganization`, `SchemaIdentifier`, `ScholarlyArticle`, `RepoMetadata`
- Currently defined as Kysely column types. Shared defines canonical types, api's Kysely schema references them.

**Domain types (depend on above):**
- `Software`, `SoftwareInList`, `SoftwareData`
- `Instance`, `InstanceFormData`, `SoftwareFormData`, `DeclarationFormData`
- `CreateUserParams`, `UserWithId`
- `Catalogi` type (depends on `Software`)

**Config types:**
- `UiConfig`, `ConfigurableUseCaseName` — move Zod schema to shared (both api and web need it, adds `zod` as shared dep)
- `SoftwareExternalDataOption`, `GetSoftwareExternalDataOptions`

### Key refactoring

- **Kysely types → shared**: currently `SchemaPerson` etc. are column types. Invert: define in shared, Kysely schema imports from shared.
- **Usecase types → shared**: `Software`, `Instance` etc. must be extracted from `readWriteSillData` as pure type definitions.
- **`ApiTypes` namespace → removed**: web imports directly from `@catalogi/shared`.
- **`api/src/lib/ApiTypes.ts` → deleted**
- **`api/src/lib/index.ts` → slimmed to tRPC types only**:
  ```typescript
  export type { TrpcRouter };
  export type TrpcRouterInput = inferRouterInputs<TrpcRouter>;
  export type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>;
  export type { Translations };
  ```

### Web migration (all ~37 files)

All `import ... from "api"` that use domain types change to `from "@catalogi/shared"`. Only tRPC type imports stay as `from "api"`:
- `web/src/core/ports/SillApi.ts` — keeps `from "api"` (TrpcRouterInput/Output)
- `web/src/core/adapter/sillApi.ts` — keeps `from "api"` (TrpcRouter)
- `web/src/ui/i18n/@types/i18next.d.ts` — keeps `from "api"` (Translations)

### Verification

```bash
pnpm typecheck
pnpm test
pnpm build
# Grep to verify no remaining ApiTypes usage:
grep -r "ApiTypes" web/src/  # should be empty
grep -r "from \"api\"" web/src/  # should only show tRPC/Translations imports
```

### Risks
- Largest change — many files touched. Consider splitting into sub-PRs (e.g. schema types first, then domain types, then UiConfig).
- Inverting Kysely → shared dependency: ensure Kysely column types stay compatible.

---

## Appendix: Current file contents for reference

### All files containing `yarn` as command

| File | Lines with yarn |
|------|----------------|
| `package.json` | scripts: test:e2e, test:e2e:ui, test:e2e:headed |
| `api/package.json` | scripts: dev, format, format:check, start, db:seed, db:up, dev:db:reset |
| `web/package.json` | scripts: format, format:check; dep: `"api": "*"` |
| `api/update-then-wait.sh` | `yarn job:import-from-inner-identifiers`, `yarn job:update` |
| `lefthook.yml` | 6 `yarn` commands in pre-commit, commit-msg, pre-push |
| `.github/workflows/ci.yaml` | `yarn install`, `yarn build`, `yarn migrate`, `yarn fullcheck`, `yarn test:e2e` |
| `Dockerfile.api` | `yarn install`, `yarn build`, CMD `yarn start` |
| `Dockerfile.web` | `yarn install`, `yarn postinstall`, `yarn build` |
| `docker-compose.prod.yml` | `yarn start`, `yarn update-then-wait 240` |
| `docker-compose.preprod.yml` | `yarn start`, `yarn update-then-wait 240` |
| `deployment-examples/docker-compose/docker-compose.yml` | `yarn start`, `yarn update-then-wait 240` |
| `helm-charts/catalogi/templates/api-deployment.yaml` | `["yarn", "start"]` |
| `helm-charts/catalogi/templates/update-cronjob.yaml` | `["yarn", "update"]` |
| `.vscode/launch.json` | 6 configs with `"runtimeExecutable": "yarn"` |
| `docs/2-getting-started.md` | `yarn install`, `yarn db:seed`, `yarn dev` |

### API tsconfig.json

```json
{
    "compilerOptions": {
        "module": "CommonJS",
        "target": "ES2019",
        "lib": ["ESNext", "DOM"],
        "esModuleInterop": true,
        "declaration": true,
        "outDir": "./dist",
        "sourceMap": true,
        "newLine": "LF",
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "incremental": true,
        "strict": true,
        "downlevelIteration": true,
        "jsx": "react-jsx",
        "noFallthroughCasesInSwitch": true,
        "skipLibCheck": true,
        "resolveJsonModule": true
    },
    "include": ["src", "scripts"]
}
```

### Web tsconfig.json

```json
{
    "compilerOptions": {
        "baseUrl": "src",
        "target": "es5",
        "lib": ["dom", "dom.iterable", "esnext"],
        "allowJs": true,
        "skipLibCheck": true,
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true,
        "strict": true,
        "noUnusedLocals": false,
        "noUnusedParameters": true,
        "forceConsistentCasingInFileNames": true,
        "module": "esnext",
        "moduleResolution": "node",
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "noFallthroughCasesInSwitch": true,
        "downlevelIteration": true,
        "strictNullChecks": true
    },
    "include": ["src"]
}
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist"]
    },
    "job:import": {},
    "job:update": {},
    "job:import-from-inner-identifiers": {},
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["typecheck"],
      "inputs": ["src/**/*.tsx", "src/**/*.ts"]
    },
    "dev": {},
    "dev:db:down": {},
    "dev:db:mig:down": {},
    "dev:db:mig:up": {},
    "dev:db:up": {},
    "dev:db:reset": {},
    "format:check": {},
    "format": {}
  }
}
```

### API entrypoints

```typescript
// api/src/entrypoints/start-api.ts
import "../instrument";
import { startRpcService } from "../rpc";
import { env } from "../env";
startRpcService(env);

// api/src/entrypoints/import.ts — same pattern with startImportService
// api/src/entrypoints/update.ts — same pattern with startUpdateService
// api/src/entrypoints/import-from-inner-identifiers.ts — same pattern
```

### Customization directory

```
api/src/customization/
├── ui-config.json
└── translations/
    ├── en.json
    └── fr.json
```

Imported in:
- `api/src/core/bootstrap.ts` — `import rawUiConfig from "../customization/ui-config.json"`
- `api/src/rpc/translations/getTranslations.ts` — `import translationEn/Fr from "../../customization/translations/*.json"`

Volume-mounted in production via Helm/docker-compose at `/app/api/dist/src/customization/` (changes to `/app/api/src/customization/` after Phase 2).

### Types currently exported from api to web

```typescript
// api/src/lib/index.ts
export type { TrpcRouter }
export type TrpcRouterInput = inferRouterInputs<TrpcRouter>;
export type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>;
export { type Language, type LocalizedString, languages }
export type { ExternalDataOriginKind }
export type { ApiTypes }
export type { Os, RuntimePlatform }

// api/src/lib/ApiTypes.ts (re-exported as namespace)
export type { SoftwareExternalDataOption, GetSoftwareExternalDataOptions }
export type { Catalogi }
export type { ExternalDataOriginKind, SchemaIdentifier, SchemaPerson, SchemaOrganization, ScholarlyArticle, RepoMetadata }
export type { CreateUserParams, UserWithId, Instance, Software, SoftwareInList, SoftwareFormData, DeclarationFormData, InstanceFormData, Source }
export type { CustomAttributes, AttributeValue, AttributeKind, AttributeDefinition }
export type { UiConfig, ConfigurableUseCaseName }
export type { Os, RuntimePlatform, SimilarSoftware }
export type Translations = { translations: typeof import("../rpc/translations/en_default.json") }
```

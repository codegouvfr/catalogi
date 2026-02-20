# Issue 491 - Execution Worklog

## Purpose
Track all implementation actions, findings, decisions, and validations for issue 491.

## Conventions
- Add one entry per meaningful step.
- Include file paths changed.
- Include validation command results.
- Record any new risk or decision immediately.

## Entries

### 2026-02-13 - Initialization
- Created plan and worklog files as docs-first step.
- Confirmed that execution starts only after this docs commit.
- Next step: begin Phase 1 (Type Foundation) from `/docs/issue-491-plan.md`.

### 2026-02-13 - Canonical software model bootstrap
- Step: start unification toward one software model with small explicit variability.
- Changes:
  - Introduced canonical `Software` type in `/api/src/core/types/SoftwareTypes.ts`.
  - Added `SoftwareVariant` discriminator (`internal`, `external`, `public`).
  - Kept `SoftwareInternal`, `SoftwareExternal`, and `SoftwarePublic` as constrained aliases of one canonical model.
  - Tightened canonical `SoftwareData` shape (`description` and `operatingSystems` required).
  - Updated type exports from `/api/src/core/types/index.ts`, `/api/src/lib/ApiTypes.ts`, and `/api/src/lib/index.ts`.
- Files:
  - `/api/src/core/types/SoftwareTypes.ts`
  - `/api/src/core/types/index.ts`
  - `/api/src/lib/ApiTypes.ts`
  - `/api/src/lib/index.ts`
- Validation:
  - `source ~/.nvm/nvm.sh && nvm use 22 && yarn --cwd api typecheck` ✅
- Findings:
  - New unification types were not yet consumed by runtime code, so this step is safe and non-breaking at behavior level.
- Decision:
  - Keep legacy runtime model for now, but enforce a single canonical type contract for upcoming mapper work.
- Risks:
  - Existing consumers of exported type aliases may need to handle `variant` when adopting canonical types.
- Next:
  - Add explicit mappers between legacy `readWriteSillData` shapes and canonical `Software`.

### 2026-02-13 - Roadmap sync
- Step: align `ROADMAP-SOFTWARE-TYPES.md` with the actual branch status.
- Changes:
  - Added a status snapshot and marked completed phases (0, 1, 1.5).
  - Added explicit canonical `Software` section (single model + variant specialization).
  - Clarified mapper policy: minimal/identity mapper accepted when shapes already match.
  - Removed stale references to deleted `getPopulatedSoftware.ts`.
  - Updated architecture note to reflect current partial DB/domain type coupling.
- Files:
  - `/ROADMAP-SOFTWARE-TYPES.md`
- Validation:
  - Manual consistency check against commits and current source tree.

### 2026-02-13 - Phase 2 kickoff (external normalization)
- Step: start Phase 2 by centralizing external shape normalization.
- Changes:
  - Added explicit mapper module:
    - `toLegacySoftwareExternalData` (legacy boundary mapper, mostly identity + date normalization)
    - `toCanonicalSoftwareExternal` (canonical mapper with explicit defaults for missing external fields)
  - Wired `createPgSoftwareExternalDataRepository.castToSoftwareExternalData` to the centralized mapper.
  - Added mapper tests.
- Files:
  - `/api/src/core/types/softwareExternalMappers.ts`
  - `/api/src/core/types/softwareExternalMappers.test.ts`
  - `/api/src/core/adapters/dbApi/kysely/createPgSoftwareExternalDataRepository.ts`
  - `/ROADMAP-SOFTWARE-TYPES.md`
- Validation:
  - `source ~/.nvm/nvm.sh && nvm use 22 && yarn --cwd api typecheck` ✅
  - `source ~/.nvm/nvm.sh && nvm use 22 && yarn --cwd api test src/core/types/softwareExternalMappers.test.ts` ✅

### 2026-02-13 - Phase 2 progression (canonical source gateway + first usecase migration)
- Step: continue Phase 2 by moving source-boundary reads to canonical `SoftwareExternal` while keeping legacy compatibility.
- Changes:
  - Added new canonical port `/api/src/core/ports/GetSoftwareExternal.ts`.
  - Extended `/api/src/core/ports/SourceGateway.ts` with canonical `softwareExternal.getById` and kept `softwareExternalData.getById` as deprecated compatibility.
  - Added `toCanonicalSoftwareExternalGetter` wrapper in `/api/src/core/types/softwareExternalMappers.ts`.
  - Wired canonical getter across all source gateways (`hal`, `wikidata`, `zenodo`, `comptoirDuLibre`, `CNLL`, `GitHub`, `GitLab`).
  - Migrated `/api/src/core/usecases/getSoftwareFormAutoFillDataFromExternalAndOtherSources.ts` to canonical fields (`name`, `description`, `image`, `license`).
  - Added mapper test coverage for canonical getter wrapping behavior.
- Files:
  - `/api/src/core/ports/GetSoftwareExternal.ts`
  - `/api/src/core/ports/SourceGateway.ts`
  - `/api/src/core/types/softwareExternalMappers.ts`
  - `/api/src/core/types/softwareExternalMappers.test.ts`
  - `/api/src/core/adapters/hal/index.ts`
  - `/api/src/core/adapters/wikidata/index.ts`
  - `/api/src/core/adapters/zenodo/index.ts`
  - `/api/src/core/adapters/comptoirDuLibre/index.ts`
  - `/api/src/core/adapters/CNLL/index.ts`
  - `/api/src/core/adapters/GitHub/index.ts`
  - `/api/src/core/adapters/GitLab/index.ts`
  - `/api/src/core/usecases/getSoftwareFormAutoFillDataFromExternalAndOtherSources.ts`
  - `/ROADMAP-SOFTWARE-TYPES.md`
- Validation:
  - `source ~/.nvm/nvm.sh && nvm use 22 && yarn --cwd api typecheck` ✅
  - `source ~/.nvm/nvm.sh && nvm use 22 && yarn --cwd api test src/core/types/softwareExternalMappers.test.ts` ✅
- Findings:
  - The canonical external shape is now consumable without changing existing source adapter implementations.
- Decision:
  - Keep dual gateway fields temporarily (`softwareExternal` canonical + `softwareExternalData` legacy) to unblock progressive migration.
- Risks:
  - Some usecases still depend on legacy external shape; full Phase 2 completion still requires DB/repository and remaining usecase migrations.
- Next:
  - Migrate `refreshExternalData.ts` and DB external repository contracts to canonical boundary objects.

### 2026-02-20 - Phase 2 remaining: external data DB migration + column rename cascade

- Step: rename `software_external_datas` columns to canonical names, cascade changes through all consumers.
- Status: **ALMOST COMPLETE** — typecheck passes, 2 cleanup items remain (see Next).
- Changes:
  1. **Kysely migration** created via `yarn --cwd api kysely migrate make rename-external-data-columns-to-canonical`.
     Two files exist — the properly-timestamped one (`1771584277207_...`) is an empty scaffold, the manually-created one (`1771583441843_...`) has the actual migration code. **TODO: copy content from old into new, delete old.**
  2. **Kysely schema** (`kysely.database.ts`): `SoftwareExternalDatasTable` columns renamed: `label`→`name`, `developers`→`authors`, `websiteUrl`→`url`, `sourceUrl`→`codeRepositoryUrl`, `documentationUrl`→`softwareHelp`, `logoUrl`→`image`, `publicationTime`→`dateCreated`, `softwareVersion`→`latestVersion` (jsonb: `{version, releaseDate}`). Added `operatingSystems` (jsonb) and `runtimePlatforms` (jsonb).
  3. **PopulatedExternalData** (`DbApiV2.ts`): changed from `Pick<SourceRow, "url" | ...>` to explicit `{ sourceUrl: string; ... }` to avoid name collision with the new canonical `url` column.
  4. **softwareExternalMappers.ts**: rewrote `toLegacySoftwareExternalData` to explicitly map canonical DB row → legacy field names (no more spread).
  5. **createPgSoftwareExternalDataRepository.ts**: all `saveMany`/`update`/`save` rewritten to map legacy `SoftwareExternalData` input → canonical DB column names.
  6. **mergeExternalData.ts**: updated destructuring to use `sourceUrl` (from new `PopulatedExternalData` shape).
  7. **createPgSoftwareRepository.ts**: updated `getFullList`/`getDetails` to use canonical column names (`image`, `authors`, `url`, `codeRepositoryUrl`, `softwareHelp`, `latestVersion`, `dateCreated`). SQL selects use `s.url as sourceUrl`.
  8. **createGetCompiledData.ts**: updated `softwareVersion`→`latestVersion.version`, `publicationTime`→`dateCreated`, `similar.label`→`similar.name`, source join `s.url`→`s.url as sourceUrl`.
  9. **test.helpers.ts**: `emptyExternalData`/`emptyExternalDataCleaned` updated to canonical column names + added `operatingSystems`/`runtimePlatforms`.
  10. **Test files updated**: `mergeExternalData.test.ts`, `createPgSoftwareRepository.test.ts`, `pgDbApi.integration.test.ts`, `refreshExternalData.test.ts` — all legacy column names replaced with canonical.
  11. **docs/issue-491-context.md**: created full context document.
- Files changed:
  - `api/src/core/adapters/dbApi/kysely/kysely.database.ts`
  - `api/src/core/adapters/dbApi/kysely/migrations/1771583441843_rename-external-data-columns-to-canonical.ts` (OLD — to delete)
  - `api/src/core/adapters/dbApi/kysely/migrations/1771584277207_rename-external-data-columns-to-canonical.ts` (NEW — empty scaffold)
  - `api/src/core/adapters/dbApi/kysely/createPgSoftwareExternalDataRepository.ts`
  - `api/src/core/adapters/dbApi/kysely/createPgSoftwareRepository.ts`
  - `api/src/core/adapters/dbApi/kysely/createGetCompiledData.ts`
  - `api/src/core/adapters/dbApi/kysely/mergeExternalData.ts`
  - `api/src/core/ports/DbApiV2.ts`
  - `api/src/core/types/softwareExternalMappers.ts`
  - `api/src/tools/test.helpers.ts`
  - `api/src/core/adapters/dbApi/kysely/mergeExternalData.test.ts`
  - `api/src/core/adapters/dbApi/kysely/createPgSoftwareRepository.test.ts`
  - `api/src/core/adapters/dbApi/kysely/pgDbApi.integration.test.ts`
  - `api/src/core/usecases/refreshExternalData.test.ts`
  - `docs/issue-491-context.md`
- Validation:
  - `yarn --cwd api typecheck` ✅ (passes)
  - Tests NOT yet run (need DB up)
- Findings:
  - `PopulatedExternalData` had a `url` name collision after rename — resolved by introducing `sourceUrl` for the source's API URL.
  - `latestVersion` migration: text→jsonb using `jsonb_build_object('version', old_value, 'releaseDate', NULL)`.
- Decision:
  - Use `yarn --cwd api kysely migrate make <name>` for migrations (proper timestamp).
- Risks:
  - Migration file needs consolidation (copy content from `1771583441843` → `1771584277207`, delete old).
  - Integration tests not yet validated against real DB.

### 2026-02-20 - Phase 3: softwares table column rename

- Step: rename `softwares` table columns to canonical schema + replace `SoftwareType` union with `operatingSystems`/`runtimePlatforms`.
- Commit: `07cda519` (softwares table rename), `a156a9b5` (SoftwareType → operatingSystems+runtimePlatforms)
- Files: Kysely migration, `kysely.database.ts`, `createPgSoftwareRepository.ts`, `createGetCompiledData.ts`, `createSoftware.ts`, `updateSoftware.ts`, `readWriteSillData/types.ts`, `CompileData.ts`, `router.ts`, Zod schemas, test files, web components.
- Validation: typecheck ✅, tests ✅

### 2026-02-20 - Phase 4: domain + web migration

- Step: migrate domain types and web to canonical field names (`operatingSystems`, `runtimePlatforms`).
- Commit: `a156a9b5`
- Files: web usecases, UI pages (SoftwareForm, SoftwareCatalog, SoftwareDetails), i18n.
- Validation: typecheck ✅

### 2026-02-20 - Phase 5: cleanup

- Step: remove dead code, rename misleading identifiers.
- Changes:
  1. Removed `CanonicalSoftware` alias (0 consumers).
  2. Removed unused type re-exports from `lib/`: `SoftwareVariant`, `Dereferencing`, `SimilarSoftware`, `SoftwareData`, `SoftwareInternal`, `SoftwareExternal`, `SoftwarePublic`. Kept `Os`, `RuntimePlatform`, `Software`.
  3. Renamed `resolveSoftwareType` → `resolveOsAndPlatforms` in `utils.ts` + 3 call sites (HAL, GitHub, GitLab adapters).
- Files:
  - `api/src/core/types/index.ts`
  - `api/src/lib/ApiTypes.ts`
  - `api/src/lib/index.ts`
  - `api/src/core/utils.ts`
  - `api/src/core/adapters/hal/getSoftwareForm.ts`
  - `api/src/core/adapters/GitHub/getSofrwareFormData.ts`
  - `api/src/core/adapters/GitLab/getSoftwareFormData.ts`
- Validation: API typecheck ✅, web typecheck ✅

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

### 2026-02-20 - Phase 5b: remaining legacy inventory

**Remaining Legacy Items:**

1. **`ServiceProvider` type** (`readWriteSillData/types.ts:172-178`)
   - Marked obsolete. `CompileData.ts` uses it but `SchemaOrganization` already covers the shape.
   - Removal: replace with `SchemaOrganization` in `CompileData.ts`, delete type, remove from `ApiTypes.ts`.

2. **`LegacySimilarSoftware` namespace** (`readWriteSillData/types.ts:80-101`)
   - Discriminated union (`registered: true/false`). Canonical `SimilarSoftware` in `SoftwareTypes.ts` uses flat `isInCatalogi` boolean.
   - Removal: adopt canonical `SimilarSoftware` in domain, repo builder, web.

3. **`toCanonicalSoftwareExternalGetter` wrapper** (`softwareExternalMappers.ts:110-122`)
   - Each adapter returns legacy `SoftwareExternalData`, wrapper converts to `SoftwareExternal`.
   - Removal: make each adapter return `SoftwareExternal` directly, delete wrapper.

4. **`softwareExternalData` deprecated gateway field** (`SourceGateway.ts:18`)
   - Dual field: `softwareExternal` (canonical) + `softwareExternalData` (legacy).
   - Removal: once adapters return canonical, delete deprecated field + all references.

5. **`SoftwareExternalData` legacy type** (`GetSoftwareExternalData.ts:24-52`)
   - Legacy field names (`developers`, `label`, `logoUrl`, `websiteUrl`, `sourceUrl`, `documentationUrl`, `softwareVersion`, `publicationTime`).
   - Removal: once all consumers use canonical `SoftwareExternal`, delete type.

6. **Legacy domain field names** (`readWriteSillData/types.ts`)
   - `softwareName`→`name`, `softwareDescription`→`description`, `logoUrl`→`image`, `officialWebsiteUrl`→`url`, `documentationUrl`→`softwareHelp`, `serviceProviders`→`providers`.
   - Removal: rename in domain types, tRPC, web (breaking tRPC contract).

7. **DB repo `update`/`save` accepting `SoftwareExternalData`** (`createPgSoftwareExternalDataRepository.ts`)
   - Maps legacy field names to canonical DB columns.
   - Removal: accept `SoftwareExternal` directly, simplify mapping.

### 2026-02-26 - Phase 6: Web canonical rename + SimilarSoftwareExternalData migration

- Step: rename all legacy field names to canonical names across API external types and entire web codebase.
- Status: **COMPLETE** — API typecheck ✅, web typecheck ✅, API unit tests pass (integration tests fail due to no DB, pre-existing)

**API changes (Steps 1-2):**

1. **`SoftwareExternalData.label` → `name`** (`GetSoftwareExternalData.ts:28`)
2. **`SimilarSoftwareExternalData` Pick** updated: `"label"` → `"name"` (`GetSoftwareExternalData.ts:56`)
3. **`SoftwareExternalDataOption.label` → `name`** + zod schema (`GetSoftwareExternalDataOptions.ts`)
4. **`SoftwareInList.similarSoftwares`** shape: `{ name, label }` → `{ softwareName, name }` (avoids conflict; `softwareName` = catalog name, `name` = external data name) (`readWriteSillData/types.ts:34`)
5. **`AutoFillData`** type: `softwareName`→`name`, `softwareDescription`→`description`, `softwareLicense`→`license`, `softwareLogoUrl`→`image` (`getSoftwareFormAutoFillDataFromExternalAndOtherSources.ts`)
6. **All source adapter `softwareOptions`** implementations: `label:` → `name:` (wikidata, GitHub, GitLab, HAL, CDL, Zenodo)
7. **Router** `getExternalSoftwareOptions` return mapping: `label` → `name` (`router.ts:174`)
8. **`toLegacySoftwareExternalData`** mapper: `label: row.name` → `name: row.name` (`softwareExternalMappers.ts:29`)
9. **`saveSimilarSoftwares`** destructuring: `label` → `name` (`createPgSoftwareRepository.ts:462`)
10. **`createGetCompiledData`** similar mapping: `"label"` → `"name"` (`createGetCompiledData.ts:146`)
11. **`createSoftware.ts`**: `label: similarSoftwareExternalData.label` → `name: similarSoftwareExternalData.name`
12. **`createPgSoftwareExternalDataRepository.ts`**: `saveMany`/`toDbValues` — `data.label` → `data.name`
13. **`aggregateSimilars`** helper: return type + mapping updated to `{ softwareName, name }`
14. **All test files** updated: `test.helpers.ts`, `createSoftware.test.ts`, `updateSoftware.test.ts`, `refreshExternalData.test.ts`, `pgDbApi.integration.test.ts`, `getHalSoftware.test.ts`, `zenodoGateway.test.ts`, `softwareExternalMappers.test.ts`
15. **API rebuilt** (`yarn --cwd api build`) to expose canonical types to web

**Web changes (Steps 4-8):**

16. **softwareDetails** state: `softwareId`→`id`, `softwareName`→`name`, `softwareDescription`→`description`, `logoUrl`→`image`, `officialWebsiteUrl`→`url`, `documentationUrl`→`softwareHelp`, `serviceProviders`→`providers`
17. **softwareDetails** thunks: all destructuring and return mappings updated
18. **softwareCatalog** state: `softwareName`→`name` in searchResults type
19. **softwareCatalog** thunks: `softwareName`→`name`, `softwareDescription`→`description`, `logoUrl`→`image`, `similarSoftware.label`→`similarSoftware.name`
20. **softwareCatalog** selectors: all `softwareName` → `name`, helper renames
21. **softwareForm** state: step2 fields `softwareName`→`name`, `softwareDescription`→`description`, `softwareLicense`→`license`, `softwareLogoUrl`→`image`, `softwareKeywords`→`keywords`; step4 `label`→`name`
22. **softwareForm** thunks: autofill response, update init, submit mapping, similar softwares
23. **softwareForm** evt: payload field access updated
24. **softwareUserAndReferent**: state/thunks/selectors — `softwareName`→`name`, `logoUrl`→`image`
25. **instanceForm**: state/thunks/evt — `softwareName`→`name`, `softwareDescription`→`description`
26. **redirect**: thunks — destructuring updated
27. **declarationForm**: state/thunks — `softwareName`→`name`, `logoUrl`→`image`
28. **userProfile**: selectors — `softwareName`→`name`
29. **UI components**: SoftwareCatalogCard, SoftwareCatalog, SoftwareCatalogControlled, PreviewTab, HeaderDetailCard, SoftwareDetails, AlikeSoftwareTab, CnllServiceProviderModal, Step1 (instance), Step2 (software), SoftwareForm, Step4, SoftwareUserAndReferent, DeclarationForm, UserProfile, DeclarationRemovalModal — all field accesses renamed
30. **SmartLogo** `logoUrl` prop kept as-is (UI component prop, not a state field)

- Validation:
  - `yarn --cwd api typecheck` ✅
  - `yarn --cwd web typecheck` ✅
  - API tests: unit tests ✅, integration tests fail (pre-existing: DB not running + 2 flaky wikidata API tests)
- Decision:
  - `SoftwareInList.similarSoftwares` renamed `name`→`softwareName` (catalog name) and `label`→`name` (external data name) to avoid field name conflict
  - SmartLogo's `logoUrl` prop kept (UI concern, not a domain type field)
  - Function parameters like `initialize({ softwareId })` kept (not state fields)

### 2026-02-26 - Phase 7: eliminate legacy SoftwareExternalData + softwares.logoUrl rename

- Step: remove remaining legacy types and mappers, rename softwares.logoUrl → image.
- Status: **COMPLETE** — all typecheck ✅, all tests ✅

**Changes:**

1. **Committed Phase 6** (commit `c53a4cc3`)
2. **Deleted `softwareExternalMappers.ts` + test** — `toLegacySoftwareExternalData` and `castToSoftwareExternalData` no longer needed
3. **Removed `castToSoftwareExternalData` callers** — `createGetCompiledData.ts`, `refreshExternalData.ts`, `createSoftware.ts` now pass DB rows directly
4. **Updated `CompileData.ts`** — `softwareExternalData` field type changed from `SoftwareExternalData` to `DatabaseDataType.SoftwareExternalDataRow`
5. **Simplified `createPgSoftwareExternalDataRepository.ts`** — removed `isCanonical()` discriminator, removed legacy `SoftwareExternalData` branch from `toDbValues`, accepts `SoftwareExternal | DatabaseDataType.SoftwareExternalDataRow`
6. **Updated `DbApiV2.ts`** — `update`/`save` param changed from `SoftwareExternalData | SoftwareExternal` to `SoftwareExternal | DatabaseDataType.SoftwareExternalDataRow`
7. **Deleted `SoftwareExternalData` and `GetSoftwareExternalData` types** from `GetSoftwareExternalData.ts` — kept `Language`, `LocalizedString`, `languages`, redefined `SimilarSoftwareExternalData` independently
8. **Renamed `softwares.logoUrl` → `image`** — migration `1772105164020`, `SoftwaresTable`, `Db.SoftwareRow`, `SoftwareExtrinsicRow`, `createPgSoftwareRepository.ts`, `createGetCompiledData.ts`, `CompileData.ts`, `createSoftware.ts`, `updateSoftware.ts`
9. **Updated all test fixtures** — `pgDbApi.integration.test.ts`, `refreshExternalData.test.ts`, `createSoftware.test.ts`, `updateSoftware.test.ts`, `routes.e2e.test.ts`, `createPgSoftwareRepository.test.ts`, `zenodoGateway.test.ts`

- Files deleted:
  - `api/src/core/types/softwareExternalMappers.ts`
  - `api/src/core/types/softwareExternalMappers.test.ts`
- Validation:
  - `yarn --cwd api typecheck` ✅
  - `yarn --cwd web typecheck` ✅
  - `yarn --cwd api build` ✅
  - `yarn --cwd api test` ✅ (66 passed, 4 skipped)

### 2026-02-26 - Phase 8: final cleanup — delete orphaned code, inline CompileData types, delete Db namespace

- Step: delete dead types/files, inline `Db.*` into `CompileData.ts`, fix zenodo test fixture.
- Status: **COMPLETE** — all typecheck ✅, all non-DB tests ✅, API build ✅

**Changes:**

1. **Deleted `PartialNoOptional.ts`** — 0 consumers after `SoftwareExternalData` deletion
2. **Inlined `Db.*` types into `CompileData.ts`** — replaced `Pick<Db.SoftwareRow, ...>` with explicit field types in `Common`, replaced `Pick<Db.AgentRow, ...>` + `Pick<Db.SoftwareUserRow, ...>` + `Pick<Db.SoftwareReferentRow, ...>` with inline field types in `Private`. Removed `Db` import.
3. **Deleted `CompileData` function type + `PartialSoftware` namespace** — never called, only `CompiledData` namespace and `compiledDataPrivateToPublic` kept.
4. **Removed `Db` import from `createGetCompiledData.ts`** — inlined `Db.AgentRow` as explicit object type in `agentById` declaration.
5. **Deleted `DbApi.ts`** — zero consumers after inlining.
6. **Fixed zenodo test fixture** (`zenodoGateway.test.ts`): `softwareName`→`name`, `softwareDescription`→`description`, `softwareLicense`→`license`, `softwareLogoUrl`→`image`, `softwareKeywords`→`keywords`, `similarSoftwareExternalDataIds`→`similarSoftwareExternalDataItems`, added missing `customAttributes: undefined`.
7. **Removed `externalId`/`sourceSlug` from `CompiledData.Software.Common`** — never populated by `createGetCompiledData`, always undefined. Dead fields.

- Files deleted:
  - `api/src/tools/PartialNoOptional.ts`
  - `api/src/core/ports/DbApi.ts`
- Files modified:
  - `api/src/core/ports/CompileData.ts`
  - `api/src/core/adapters/dbApi/kysely/createGetCompiledData.ts`
  - `api/src/core/adapters/zenodo/zenodoGateway.test.ts`
- Validation:
  - `yarn --cwd api typecheck` ✅
  - `yarn --cwd web typecheck` ✅
  - `yarn --cwd api build` ✅
  - `yarn --cwd api test` — 34 passed, 4 skipped, 25 failed (all DB auth failures, pre-existing)

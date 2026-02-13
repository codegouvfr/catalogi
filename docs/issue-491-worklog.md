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

### Template for next entries
- Date/time:
- Step:
- Changes:
- Files:
- Validation:
- Findings:
- Decision:
- Risks:
- Next:

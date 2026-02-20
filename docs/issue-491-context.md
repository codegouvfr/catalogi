# Issue 491: Software Type Unification — Full Context

> **Branch**: `uniform-software-shape`
> **Issue**: https://github.com/codegouvfr/catalogi/issues/491
> **See also**: `ROADMAP-SOFTWARE-TYPES.md`, `docs/issue-491-plan.md`, `docs/issue-491-worklog.md`

## What This Migration Is

Unify all software types around a single Schema.org/CodeMeta canonical model.

Before: two incompatible shapes (`Software` domain type vs `SoftwareExternalData`) with different field names, different nullability rules, merged at query time.

After: one `SoftwareData` base shape, three typed variants (`SoftwareInternal`, `SoftwareExternal`, `SoftwarePublic`).

## Architecture: Before vs After

### BEFORE (main branch)

```
External sources (wikidata, HAL, etc.)
  → GetSoftwareExternalData port
  → SoftwareExternalData type (label, developers, websiteUrl, sourceUrl, logoUrl...)
  → stored in software_external_datas table
  → mergeExternalData() deep-merges by source priority
  → merged into Software domain type at query time
       (softwareName, officialWebsiteUrl, documentationUrl, logoUrl,
        softwareType: Desktop{os:Record<Os,bool>} | Cloud | Stack,
        similarSoftwares: discriminated union registered/not)
```

### AFTER (target)

```
External sources
  → GetSoftwareExternal port (canonical)
  → SoftwareExternal type (same SoftwareData base)
  → stored in software_external_datas table (renamed columns)
  → merged into SoftwarePublic at query time

One shape: SoftwareData base
  name, description, image, url, codeRepositoryUrl,
  softwareHelp, operatingSystems, runtimePlatforms,
  authors, providers, sameAs
```

## Field Rename Table

| Legacy | Canonical | Notes |
|--------|-----------|-------|
| `softwareName` / `label` | `name` | `LocalizedString` |
| `softwareDescription` | `description` | `LocalizedString` |
| `logoUrl` | `image` | |
| `officialWebsiteUrl` / `websiteUrl` | `url` | |
| `sourceUrl` | `codeRepositoryUrl` | |
| `documentationUrl` | `softwareHelp` | |
| `developers` | `authors` | |
| `serviceProviders` | `providers` | |
| `publicationTime` | `dateCreated` | ISO string |
| `softwareVersion` / `semVer` | `latestVersion.version` | |
| `referencedSinceTime` | `addedTime` | ISO string |
| `similarSoftwares` | `sameAs` | flat type |
| `softwareType` (discriminated union) | `operatingSystems` + `runtimePlatforms` | split |
| `softwareId` | `id` | |

## Completed Work (Phases 0–2 partial)

- Phase 0: `versionMin` → `customAttributes` jsonb ✅
- Phase 1 + 1.5: Canonical types in `api/src/core/types/SoftwareTypes.ts` ✅
- Phase 2 (partial): External normalization ✅
  - Mapper layer (`softwareExternalMappers.ts`)
  - Dual gateway (`SourceGateway.ts`)
  - All 7 source adapters wired
  - Autofill usecase migrated
  - Legacy renames (`Os`→`LegacyOs`, `SimilarSoftware`→`LegacySimilarSoftware`)

## Resolved Decisions

1. `name` DB: keep as plain `string` (valid `LocalizedString`)
2. `description` DB: migrate to jsonb `LocalizedString` in Phase 3
3. List type: keep slim list type for `getFullList()` perf
4. Time format: migrate to ISO strings
5. `repoMetadata`: add to canonical `SoftwareData`

## Key Files

| Purpose | File |
|---------|------|
| Canonical types | `api/src/core/types/SoftwareTypes.ts` |
| Mappers | `api/src/core/types/softwareExternalMappers.ts` |
| Legacy domain types | `api/src/core/usecases/readWriteSillData/types.ts` |
| Legacy DB port | `api/src/core/ports/DbApi.ts` |
| DB v2 port | `api/src/core/ports/DbApiV2.ts` |
| Source gateway | `api/src/core/ports/SourceGateway.ts` |
| Kysely schema | `api/src/core/adapters/dbApi/kysely/kysely.database.ts` |
| Software repo | `api/src/core/adapters/dbApi/kysely/createPgSoftwareRepository.ts` |
| External data repo | `api/src/core/adapters/dbApi/kysely/createPgSoftwareExternalDataRepository.ts` |
| Merge logic | `api/src/core/adapters/dbApi/kysely/mergeExternalData.ts` |
| tRPC router | `api/src/rpc/router.ts` |

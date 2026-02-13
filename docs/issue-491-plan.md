# Issue 491 - Software Model Unification Plan

## Context
Tracking issue: https://github.com/codegouvfr/catalogi/issues/491

This document is the decision-complete implementation plan.
Execution starts only after this file and the worklog are committed.

## Goal
Adopt a canonical software model based on shared `SoftwareData`:
- `SoftwareInternal = SoftwareData + internal Catalogi fields`
- `SoftwareExternal = SoftwareData + external source identity`

Keep compatibility at boundaries during migration.

## Canonical Target Types

```ts
type SoftwareInternal = SoftwareData & {
    id: number;
    dereferencing: Dereferencing | undefined;
    customAttributes: CustomAttributes | undefined;
};

type SoftwareExternal = SoftwareData & {
    externalId: string;
    sourceSlug: string;
    id: number | undefined;
};

type SoftwareData = {
    addedTime: string;
    updateTime: string;

    name: LocalizedString;
    description: LocalizedString;
    image: string | undefined;

    url: string | undefined;
    codeRepositoryUrl: string | undefined;
    softwareHelp: string | undefined;

    dateCreated: string | undefined;
    latestVersion:
        | {
              version: string | undefined;
              releaseDate: string | undefined;
          }
        | undefined;

    keywords: string[];
    applicationCategories: string[];
    programmingLanguages: string[];

    operatingSystems: Record<Os, boolean>;
    runtimePlatforms: RuntimePlatform[];

    authors: Array<SchemaPerson | SchemaOrganization>;
    providers: Array<SchemaOrganization>;

    license: string | undefined;
    isLibreSoftware: boolean | undefined;

    referencePublications: ScholarlyArticle[];
    identifiers: SchemaIdentifier[];

    sameAs: SimilarSoftware[];
};
```

## Findings (current state)
1. The branch currently mixes legacy and new naming, which risks drift if both shapes are edited directly.
2. `getPopulatedSoftware.ts` is removed upstream and must not be used as a migration anchor.
3. The roadmap still references removed/deprecated paths and needs alignment with active code paths.
4. Compatibility aliases (`LegacyOs`, legacy similar software types) are required short-term but should be boundary-only.

## Scope
In scope:
- Core domain type unification.
- DB/repository mapping alignment.
- API and web migration in controlled phases.
- Legacy compatibility and cleanup.

Out of scope:
- Unrelated feature work.
- Broad refactors not needed for model migration.

## Migration Rules
1. Canonical model lives in domain types.
2. Legacy model is compatibility-only.
3. No hidden dual-write semantics.
4. Every phase has explicit stop criteria and tests.
5. Keep API compatibility until planned switch.

## Phases

### Phase 0 - Baseline
- Confirm rebase complete.
- Confirm docs-only plan/worklog commit exists.
Stop condition:
- Clean branch state, plan committed.

### Phase 1 - Type Foundation
- Finalize canonical domain types.
- Define strict mapper interfaces between legacy and canonical models.
- Keep current exports compatible.
Stop condition:
- Typecheck passes with no behavioral change.

### Phase 2 - Adapter/Repository Alignment
- Apply canonical mapping at repository boundaries.
- Keep legacy outputs via adapter mappers where required.
Stop condition:
- Existing behavior unchanged, mapper tests added.

### Phase 3 - API Surface Migration
- Migrate internal API/tRPC assembly to canonical model.
- Preserve external contract where required.
Stop condition:
- Contract tests and regression tests pass.

### Phase 4 - Web Migration
- Migrate web usecases/selectors/components from legacy field names to canonical fields via stable mapping layer.
Stop condition:
- Catalog, details, form, declaration flows validated.

### Phase 5 - Cleanup
- Remove unused legacy aliases/types and dead mappers.
- Update docs.
Stop condition:
- No legacy model references outside compatibility boundaries.

## Testing Strategy
- Type checks per phase.
- Unit tests for mappers.
- Integration tests for repositories/usecases.
- Contract/regression tests for API/web critical flows.

## Risks and Mitigations
1. Risk: schema drift between legacy and canonical shapes.
Mitigation: single canonical ownership + explicit mappers.
2. Risk: regressions in details/catalog flows.
Mitigation: focused regression cases and phased rollout.
3. Risk: localization loss during normalization.
Mitigation: preserve translated strings and test mapping fidelity.

## Acceptance Criteria
1. Canonical model is the source of truth.
2. Legacy model exists only at compatibility boundaries.
3. Tests pass for core mapping, API, and web critical flows.
4. Roadmap/docs reflect actual implemented architecture.

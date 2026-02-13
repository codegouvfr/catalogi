# Roadmap: Unification des types Software

> Issue de suivi: https://github.com/codegouvfr/catalogi/issues/491
> Source de vérité d'exécution: ce fichier + `docs/issue-491-plan.md` + `docs/issue-491-worklog.md` (la description GitHub sert surtout de contexte)

## Objectif

Créer une architecture de types unifiée basée sur Schema.org/CodeMeta pour les données logicielles.

---

## Statut actuel (2026-02-13)

- [x] Rebase terminé et branche stable
- [x] Phase 0 terminée (migration `versionMin` -> `customAttributes`)
- [x] Phase 1 terminée (nouveaux types + exports)
- [x] Bootstrap modèle canonique unique (`Software` + variantes `internal|external|public`)
- [ ] Phase 2+ non démarrées (mappers/normalisation + migration runtime)

**Commits clés récents**: `d6f5df93`, `049deae4`, `21a99547`

---

## Nouveaux types TypeScript

### Types de base (nouveaux)

```typescript
type Os = "windows" | "linux" | "mac" | "android" | "ios";
type RuntimePlatform = "cloud" | "mobile" | "desktop";

type Dereferencing = {
    reason: string | undefined;
    time: string;  // ISO
    lastRecommendedVersion: string | undefined;
};
```

### Types réutilisés (existants)

Ces types existent déjà et sont réutilisés sans modification:

| Type | Source | Notes |
|------|--------|-------|
| `LocalizedString` | `GetSoftwareExternalData.ts` | Type i18nifty existant |
| `SchemaPerson` | `kysely.database.ts` | Schema.org Person |
| `SchemaOrganization` | `kysely.database.ts` | Schema.org Organization |
| `SchemaIdentifier` | `kysely.database.ts` | Schema.org PropertyValue |
| `ScholarlyArticle` | `kysely.database.ts` | Schema.org ScholarlyArticle |
| `CustomAttributes` | `attributeTypes.ts` | Attributs personnalisés |
| `Instance` | `readWriteSillData/types.ts` | Instances de logiciel |

> **Note**: L'isolation DB/domaine est partielle actuellement. Cible: finaliser la séparation via un module de types partagé neutre, tout en gardant `Os` et `RuntimePlatform` définis côté domaine.

### SoftwareData (données communes)

```typescript
type SoftwareData = {
    // === Dates Catalogi (toujours présentes) ===
    addedTime: string;                              // ISO - requis
    updateTime: string;                             // ISO - requis

    // === Métadonnées de base (Schema.org) ===
    name: LocalizedString;                          // schema: name - requis
    description: LocalizedString;                   // schema: description
    image: string | undefined;                      // schema: image

    // === URLs ===
    url: string | undefined;                        // schema: url
    codeRepositoryUrl: string | undefined;          // schema: codeRepository
    softwareHelp: string | undefined;               // schema: softwareHelp

    // === Version et dates ===
    dateCreated: string | undefined;                // schema: dateCreated (ISO)
    latestVersion: {
        version: string | undefined;
        releaseDate: string | undefined;            // ISO
    } | undefined;

    // === Catégorisation ([] si vide) ===
    keywords: string[];                             // schema: keywords
    applicationCategories: string[];                // schema: applicationCategory
    programmingLanguages: string[];                 // schema: programmingLanguage

    // === Plateformes ===
    operatingSystems: Record<Os, boolean>;                // schema: operatingSystem
    runtimePlatforms: RuntimePlatform[];                  // cloud, mobile, desktop - [] si vide

    // === Acteurs ([] si vide) ===
    authors: Array<SchemaPerson | SchemaOrganization>;    // schema: author
    providers: Array<SchemaOrganization>;                 // schema: provider

    // === Licence et accessibilité ===
    license: string | undefined;                    // schema: license
    isLibreSoftware: boolean | undefined;           // schema: isAccessibleForFree

    // === Références ([] si vide) ===
    referencePublications: ScholarlyArticle[];      // codemeta: referencePublication
    identifiers: SchemaIdentifier[];                // schema: identifier

    // === Relations ([] si vide) ===
    sameAs: SimilarSoftware[];                      // schema: sameAs
};
```

**Principe de nullabilité:**
- **Requis**: `name`, `addedTime`, `updateTime` (minimum vital pour exister)
- **Tableaux**: `[]` par défaut si vide (jamais undefined)
- **Scalaires/Objets**: `| undefined` si la donnée peut manquer

### SoftwareInternal (données Catalogi stockées)

```typescript
type SoftwareInternal = SoftwareData & {
    id: number;
    dereferencing: Dereferencing | undefined;
    customAttributes: CustomAttributes | undefined;  // versionMin va ici
};
```

### SoftwareExternal (données sources externes)

```typescript
type SoftwareExternal = SoftwareData & {
    externalId: string;
    sourceSlug: string;
    id: number | undefined;  // lié à un SoftwareInternal ou non
};
```

### SoftwarePublic (données exposées via API avec calculs)

```typescript
type SoftwarePublic = SoftwareInternal & {
    userAndReferentCountByOrganization: Record<string, {
        userCount: number;
        referentCount: number;
    }>;
    hasExpertReferent: boolean;
    instances: Instance[];
};
```

### Software (canonique, variabilité minimale)

```typescript
type Software = SoftwareData & {
    variant: "internal" | "external" | "public";
    id: number | undefined;
    externalId: string | undefined;
    sourceSlug: string | undefined;
    dereferencing: Dereferencing | undefined;
    customAttributes: CustomAttributes | undefined;
    userAndReferentCountByOrganization: Record<string, {
        userCount: number;
        referentCount: number;
    }> | undefined;
    hasExpertReferent: boolean | undefined;
    instances: Instance[] | undefined;
};
```

`SoftwareInternal`, `SoftwareExternal` et `SoftwarePublic` sont conservés comme vues spécialisées du type canonique `Software`.

### SimilarSoftware (nouveau)

```typescript
type SimilarSoftware = {
    externalId: string;
    sourceSlug: string;
    name: LocalizedString;
    description: LocalizedString;
    isLibreSoftware: boolean | undefined;
    isInCatalogi: boolean;
    softwareId: number | undefined;  // si dans Catalogi
};
```

---

## Tableau des changements de nommage

| Ancien | Nouveau | Type |
|--------|---------|------|
| `softwareId` | `id` | number |
| `softwareName` | `name` | LocalizedString |
| `softwareDescription` | `description` | LocalizedString |
| `label` | `name` | LocalizedString |
| `developers` | `authors` | Array |
| `officialWebsiteUrl` | `url` | string |
| `websiteUrl` | `url` | string |
| `sourceUrl` | `codeRepositoryUrl` | string |
| `documentationUrl` | `softwareHelp` | string |
| `logoUrl` | `image` | string |
| `publicationTime` | `dateCreated` | ISO string |
| `softwareVersion` | `latestVersion.version` | string |
| `referencedSinceTime` | `addedTime` | ISO string |
| `serviceProviders` | `providers` | Array |
| `similarSoftwares` | `sameAs` | Array |
| `softwareType` | `operatingSystems` + `runtimePlatforms` | séparés |
| `semVer` | `latestVersion.version` | string |

---

## Plan d'implémentation par phases

### Phase 0: Migration versionMin → customAttributes ✅

- [x] **Objectif**: Nettoyer versionMin sans toucher aux types

**Tâches**:
- [x] Créer migration Kysely pour:
  - [x] Lire `version_min` de chaque software
  - [x] L'ajouter dans `custom_attributes` sous la clé `versionMin`
  - [x] Supprimer la colonne `version_min`
- [x] Adapter `createSoftware.ts` et `updateSoftware.ts` pour lire/écrire `versionMin` depuis `customAttributes`
- [x] Adapter le formulaire web si nécessaire
- [x] Mettre à jour les tests

**Commits**: `2e273116`, `a1069cb0`

**Fichiers impactés**:
- `api/src/core/adapters/dbApi/kysely/migrations/` (nouvelle migration)
- `api/src/core/adapters/dbApi/kysely/kysely.database.ts`
- `api/src/core/usecases/createSoftware.ts`
- `api/src/core/usecases/updateSoftware.ts`
- `api/src/core/usecases/readWriteSillData/types.ts`

**Point d'arrêt**: Code compile, tests passent, versionMin géré via customAttributes

---

### Phase 1: Définir les nouveaux types (sans les utiliser) ✅

- [x] **Objectif**: Ajouter les types sans casser l'existant

**Tâches**:
- [x] Créer `api/src/core/types/SoftwareTypes.ts` avec:
  - [x] Types de base: `Os`, `RuntimePlatform`, `Dereferencing`
  - [x] `SimilarSoftware` (nouveau type)
  - [x] `SoftwareData` (importe types existants: `LocalizedString`, `SchemaPerson`, `SchemaOrganization`, `SchemaIdentifier`, `ScholarlyArticle`)
  - [x] `SoftwareInternal` (importe `CustomAttributes` existant)
  - [x] `SoftwareExternal`
  - [x] `SoftwarePublic` (référence `Instance` existant)
- [x] Créer `api/src/core/types/index.ts` (barrel export)
- [x] Exporter depuis `api/src/lib/index.ts`
- [x] Coexistence maintenue avec les anciens types runtime

**Fichiers impactés**:
- `api/src/core/types/SoftwareTypes.ts` (nouveau)
- `api/src/core/types/index.ts` (nouveau)
- `api/src/lib/index.ts` (ajout exports)
- `api/src/lib/ApiTypes.ts` (exports API)

**Point d'arrêt**: Code compile, nouveaux types disponibles mais pas utilisés

---

### Phase 1.5: Bootstrap modèle canonique unique ✅

- [x] **Objectif**: Introduire un seul modèle `Software` avec variabilité minimale explicite

**Tâches**:
- [x] Ajouter `SoftwareVariant` (`internal` | `external` | `public`)
- [x] Créer `Software` canonique dans `SoftwareTypes.ts`
- [x] Garder `SoftwareInternal`/`SoftwareExternal`/`SoftwarePublic` comme alias spécialisés
- [x] Exposer `CanonicalSoftware` côté `ApiTypes`/`lib` sans casser l'alias legacy `Software`

**Fichiers impactés**:
- `api/src/core/types/SoftwareTypes.ts`
- `api/src/core/types/index.ts`
- `api/src/lib/ApiTypes.ts`
- `api/src/lib/index.ts`

**Commits**: `21a99547`

**Point d'arrêt**: Typecheck OK, aucun changement de comportement runtime

---

### Phase 2: Migrer SoftwareExternalData → SoftwareExternal

- [ ] **Objectif**: Remplacer le type des données externes

**Tâches**:
- [ ] Introduire des normaliseurs/mappers explicites `legacy <-> canonical` aux frontières (fonctions identitaires autorisées si la shape est déjà alignée)
- [ ] Créer migration Kysely pour renommer colonnes dans `software_external_datas`:
  - [ ] `label` → `name`
  - [ ] `developers` → `authors`
  - [ ] `website_url` → `url`
  - [ ] `source_url` → `code_repository_url`
  - [ ] `documentation_url` → `software_help`
  - [ ] `logo_url` → `image`
  - [ ] `publication_time` → `date_created`
  - [ ] `software_version` → split vers `latest_version` (jsonb)
  - [ ] Ajouter `operating_systems` (jsonb)
  - [ ] Ajouter `runtime_platforms` (jsonb)
  - [ ] `similar_software_external_data_ids` → `same_as`
- [ ] Adapter les 5 adapters externes:
  - [ ] `api/src/core/adapters/wikidata/getWikidataSoftware.ts`
  - [ ] `api/src/core/adapters/hal/getHalSoftwareExternalData.ts`
  - [ ] `api/src/core/adapters/zenodo/getZenodoExternalData.ts`
  - [ ] `api/src/core/adapters/comptoirDuLibre/getCDLExternalData.ts`
  - [ ] `api/src/core/adapters/CNLL/getExternalData.ts`
- [ ] Adapter `createPgSoftwareExternalDataRepository.ts`
- [ ] Adapter `mergeExternalData.ts`
- [ ] Remplacer `SoftwareExternalData` par `SoftwareExternal`
- [ ] Supprimer l'ancien type `SoftwareExternalData`

**Fichiers impactés**:
- `api/src/core/adapters/dbApi/kysely/migrations/` (nouvelle migration)
- `api/src/core/adapters/dbApi/kysely/kysely.database.ts`
- `api/src/core/adapters/dbApi/kysely/createPgSoftwareExternalDataRepository.ts`
- `api/src/core/adapters/dbApi/kysely/mergeExternalData.ts`
- `api/src/core/types/` (mappers de normalisation)
- `api/src/core/adapters/wikidata/getWikidataSoftware.ts`
- `api/src/core/adapters/hal/getHalSoftwareExternalData.ts`
- `api/src/core/adapters/zenodo/getZenodoExternalData.ts`
- `api/src/core/adapters/comptoirDuLibre/getCDLExternalData.ts`
- `api/src/core/adapters/CNLL/getExternalData.ts`
- `api/src/core/ports/GetSoftwareExternalData.ts`

**Point d'arrêt**: Code compile, données externes utilisent nouveau format

---

### Phase 3: Migrer Software → SoftwareInternal + SoftwarePublic

- [ ] **Objectif**: Remplacer le type principal

**Tâches**:
- [ ] Créer migration Kysely pour renommer colonnes dans `softwares`:
  - [ ] `name` reste `name` (déjà bon)
  - [ ] `description` reste `description` (déjà bon)
  - [ ] `logo_url` → `image`
  - [ ] `categories` → `application_categories`
  - [ ] Supprimer `software_type` (déjà migré vers operatingSystems + runtimePlatforms)
  - [ ] Ajouter `operating_systems` (jsonb)
  - [ ] Ajouter `runtime_platforms` (jsonb)
- [ ] Adapter `createPgSoftwareRepository.ts`:
  - [ ] Retourner `SoftwareInternal` pour les données stockées
  - [ ] Retourner `SoftwarePublic` pour les endpoints API
- [ ] Adapter les usecases:
  - [ ] `createSoftware.ts`
  - [ ] `updateSoftware.ts`
- [ ] Adapter `CompileData.ts`
- [ ] Adapter le router tRPC et les schemas Zod
- [ ] Supprimer les anciens types `Software`, `Db.SoftwareRow`

**Fichiers impactés**:
- `api/src/core/adapters/dbApi/kysely/migrations/` (nouvelle migration)
- `api/src/core/adapters/dbApi/kysely/kysely.database.ts`
- `api/src/core/adapters/dbApi/kysely/createPgSoftwareRepository.ts`
- `api/src/core/adapters/dbApi/kysely/createGetCompiledData.ts`
- `api/src/core/usecases/createSoftware.ts`
- `api/src/core/usecases/updateSoftware.ts`
- `api/src/core/ports/CompileData.ts`
- `api/src/core/ports/DbApi.ts`
- `api/src/core/usecases/readWriteSillData/types.ts`
- `api/src/rpc/router.ts`

**Point d'arrêt**: Code compile, API interne utilise nouveaux types

---

### Phase 4: Migrer le Web

- [ ] **Objectif**: Adapter le frontend aux nouveaux types

**Tâches**:
- [ ] Mettre à jour les types dans les usecases web:
  - [ ] `web/src/core/usecases/softwareDetails/state.ts`
  - [ ] `web/src/core/usecases/softwareDetails/thunks.ts`
  - [ ] `web/src/core/usecases/softwareCatalog/state.ts`
  - [ ] `web/src/core/usecases/softwareForm/state.ts`
  - [ ] `web/src/core/usecases/softwareForm/thunks.ts`
- [ ] Mettre à jour les composants UI:
  - [ ] `web/src/ui/pages/softwareDetails/SoftwareDetails.tsx`
  - [ ] `web/src/ui/pages/softwareDetails/PreviewTab.tsx`
  - [ ] `web/src/ui/pages/softwareCatalog/SoftwareCatalogControlled.tsx`
  - [ ] Autres composants utilisant les champs renommés
- [ ] Mettre à jour SoftwareForm pour les nouveaux noms de champs

**Fichiers impactés**:
- `web/src/core/usecases/softwareDetails/state.ts`
- `web/src/core/usecases/softwareDetails/thunks.ts`
- `web/src/core/usecases/softwareCatalog/state.ts`
- `web/src/core/usecases/softwareForm/state.ts`
- `web/src/core/usecases/softwareForm/thunks.ts`
- `web/src/ui/pages/softwareDetails/*.tsx`
- `web/src/ui/pages/softwareCatalog/*.tsx`
- `web/src/ui/pages/softwareForm/*.tsx`

**Point d'arrêt**: Code compile, UI fonctionne avec nouveaux types

---

### Phase 5: API externe v2

- [ ] **Objectif**: Exposer le nouveau format pour les consommateurs externes

**Tâches**:
- [ ] Créer endpoint `/api/v2/catalogi.json` avec nouveau format
- [ ] Garder `/api/catalogi.json` avec ancien format (rétrocompatibilité)
- [ ] Documenter les différences entre v1 et v2
- [ ] Ajouter header de dépréciation sur v1 (optionnel)

**Fichiers impactés**:
- `api/src/entrypoints/start-api.ts` ou équivalent
- `api/src/rpc/router.ts`
- Documentation

**Point d'arrêt**: Deux endpoints disponibles, consommateurs externes non impactés

---

### Phase 6: Cleanup

- [ ] **Objectif**: Supprimer le code legacy

**Tâches**:
- [ ] Supprimer les anciens types non utilisés
- [ ] Supprimer les fonctions de transformation obsolètes
- [ ] Nettoyer les imports
- [ ] Mettre à jour la documentation
- [ ] (Futur) Planifier la dépréciation de `/api/catalogi.json` v1

**Fichiers impactés**:
- Tous les fichiers avec imports obsolètes
- `CLAUDE.md` / `README.md`

**Point d'arrêt**: Codebase propre, documentation à jour

---

## Vérification par phase

Chaque phase doit passer:
1. `yarn typecheck` - Vérification des types
2. `yarn test` - Tests unitaires et intégration
3. `yarn build` - Build complet
4. Test manuel via `yarn dev`

---

## Notes importantes

- **Breaking changes API tRPC**: OK, web s'adapte dans la même PR
- **Colonnes DB**: Renommées via migrations Kysely
- **API externe**: `/api/catalogi.json` (v1) préservé, `/api/v2/catalogi.json` avec nouveau format
- **versionMin**: Migré vers `customAttributes` en Phase 0
- **softwareType**: Séparé en `operatingSystems` + `runtimePlatforms`
- **Données calculées**: `userAndReferentCountByOrganization`, `hasExpertReferent` restent calculées (pas stockées)
- **Isolation types DB/domaine**: Partielle actuellement (les types domaine réutilisent encore certains types de `kysely.database.ts`). Cible: module neutre partagé avant fin de Phase 3
- **Réutilisation types Schema.org**: `SchemaPerson`, `SchemaOrganization`, `SchemaIdentifier`, `ScholarlyArticle` sont importés depuis `kysely.database.ts` (pas redéfinis)
- **Mappers/normaliseurs**: requis uniquement aux frontières où la shape diffère; si shape identique, mapper minimal/identitaire accepté

# Architecture Notes

## Software Catalog Data Flow (Refactored Dec 2025)

The application architecture has been unified to use `SoftwareInList` as the primary data structure for the software catalog and cross-reference lists.

### Key Concepts

1.  **Single Source of Truth for Lists (`SoftwareInList`)**
    *   The `softwareCatalog` state maintains a single `softwares` array based on `SoftwareInList`.
    *   **Catalog & Navigation:** All listing, filtering, and searching relies on this type.
    *   **Details Page:** The main software details are fetched separately (full `Software` type from API), but **related items** (like "Similar Software") are represented using `SoftwareInList` to ensure consistency with the catalog cards.
    *   The type `State.Software` (exported as `Software`) extends the API's `SoftwareInList` with UI-specific augmentations:
        *   `userDeclaration`: Current user's relationship to the software.
        *   `searchHighlight`: For highlighting search terms in the UI.
        *   `search`: A pre-computed string for efficient client-side filtering.
    *   **Crucially**, `Software` is compatible with `SoftwareInList`, allowing `SoftwareCatalogCard` to handle both by deriving counts from `userAndReferentCountByOrganization` on the fly.

2.  **State Management**
    *   **Redux Slice:** `web/src/core/usecases/softwareCatalog/state.ts`
    *   **Selector:** `allSoftwares` (in `selectors.ts`) provides the complete, enriched list of softwares. This selector should be used by any component needing to look up software data (e.g., for navigation or ID resolution).

3.  **Filtering Logic**
    *   Filtering is performed directly on the `Software` (extended `SoftwareInList`) objects.
    *   **Virtual Attributes:** Filters handle "virtual" attributes that don't exist in the database JSON but are derived at runtime.
        *   Example: `isInstallableOnUserComputer` is derived from `softwareType.type` and `softwareType.os`.

4.  **Database Layer**
    *   **Repository:** `api/src/core/adapters/dbApi/kysely/createPgSoftwareRepository.ts`
    *   **Priority Merging:** When fetching software details, external data (from Wikidata, etc.) is merged based on priority. Data from sources with numeric priority `1` (Highest) will overwrite data from sources with priority `10` (Lowest).

### Development Guidelines

*   **Do not** introduce new parallel data structures for software objects. Extend the existing `Software` type if UI-specific fields are needed.
*   **Do** use the `allSoftwares` selector for cross-component software lookups (e.g., finding an ID by name).
*   **Do** ensure any new filtering logic accounts for the unified structure.

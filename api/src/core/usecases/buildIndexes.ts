import { SchemaOrganization, SchemaPerson } from "../adapters/dbApi/kysely/kysely.database";
import { DbApiV2 } from "../ports/DbApiV2";

export type SoftwareAuthorsIndex = Record<number, Array<SchemaOrganization | SchemaPerson>>;

export type MakeBuildSoftwareDevelopersIndex = (dbApi: DbApiV2) => BuildSoftwareDevelopersIndex;
export type BuildSoftwareDevelopersIndex = () => Promise<SoftwareAuthorsIndex>;

export const refreshExternalDataByExternalIdAndSlug: MakeBuildSoftwareDevelopersIndex = (dbApi: DbApiV2) => {
    return async () => {
        const index: SoftwareAuthorsIndex = {};

        // 1. Récupérer la liste complète des logiciels
        const softwareList = await dbApi.software.getFullList();

        // 2. Pour chaque logiciel, récupérer les détails
        for (const software of softwareList) {
            const softwareId = software.id;
            const populatedSoftware = await dbApi.software.getDetails(softwareId);

            // 3. Ajouter à l'index : clé = id, valeur = developers
            index[softwareId] = populatedSoftware?.authors ?? [];
        }

        return index;
    };
};

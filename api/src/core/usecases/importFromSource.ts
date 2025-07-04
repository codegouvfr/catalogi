// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DbApiV2 } from "../ports/DbApiV2";
import { halAPIGateway } from "../adapters/hal/HalAPI";
import { halRawSoftwareToSoftwareForm } from "../adapters/hal/getSoftwareForm";
import { getWikidataForm } from "../adapters/wikidata/getSoftwareForm";

export const importFromHALSource: (dbApi: DbApiV2) => (userEmail: string) => Promise<Promise<number | undefined>[]> = (
    dbApi: DbApiV2
) => {
    return async (userEmail: string) => {
        const user = await dbApi.user.getByEmail(userEmail);
        const userId = user
            ? user.id
            : await dbApi.user.add({
                  email: userEmail,
                  "isPublic": false,
                  organization: "",
                  about: "This is a bot user created to import data."
              });

        const rawHALSoftware = await halAPIGateway.software.getAll({ SWHFilter: true });
        const dbSoftwares = await dbApi.software.getAll();
        const dbSoftwaresNames = dbSoftwares.map(software => {
            return software.softwareName;
        });

        return rawHALSoftware.map(async rawHALSoftwareItem => {
            const index = dbSoftwaresNames.indexOf(rawHALSoftwareItem.title_s[0]);

            if (index != -1) {
                if (dbSoftwares[index].externalId === rawHALSoftwareItem.docid) {
                    return dbSoftwares[index].softwareId;
                }

                // Not equal -> new HAL notice version, need to update
                const newHALSoftwareForm = await halRawSoftwareToSoftwareForm(rawHALSoftwareItem);
                await dbApi.software.update({
                    softwareSillId: dbSoftwares[index].softwareId,
                    formData: newHALSoftwareForm,
                    userId: userId
                });

                return dbSoftwares[index].softwareId;
            } else {
                console.info("Importing HAL : ", rawHALSoftwareItem.docid);
                const newSoft = await halRawSoftwareToSoftwareForm(rawHALSoftwareItem);
                return dbApi.software.create({ formData: newSoft, userId });
            }
        });
    };
};

export const importFromWikidataSource: (
    dbApi: DbApiV2
) => (userEmail: string, softwareIds: string[]) => Promise<Promise<number | undefined>[]> = (dbApi: DbApiV2) => {
    return async (userEmail: string, softwareIds: string[]) => {
        const user = await dbApi.user.getByEmail(userEmail);
        const userId = user
            ? user.id
            : await dbApi.user.add({
                  email: userEmail,
                  "isPublic": false,
                  organization: "",
                  about: "This is a bot user created to import data."
              });

        const dbSoftwares = await dbApi.software.getAll();
        const dbSoftwaresNames = dbSoftwares.map(software => {
            return software.softwareName;
        });

        return softwareIds.map(async (softwareId: string) => {
            const newSoft = await getWikidataForm(softwareId);
            if (!newSoft) {
                return -1;
            }

            const index = dbSoftwaresNames.indexOf(newSoft?.softwareName ?? "");

            if (index != -1) {
                return dbSoftwares[index].softwareId;
            } else {
                console.log("Importing wikidata : ", softwareId);
                return dbApi.software.create({ formData: newSoft, userId });
            }
        });
    };
};

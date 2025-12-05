// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 UniversitÃ© Grenoble Alpes
// SPDX-License-Identifier: MIT

// Note this is temporary script, to use as long CNLL doesn't have a proper API providing their own identifiers
// Do not use this script outside of the main SILL application

import { getCnllPrestatairesSill } from "../core/adapters/getCnllPrestatairesSill";
import { DbApiV2 } from "../core/ports/DbApiV2";

export const importCnllSillOnly = async (dbApi: DbApiV2): Promise<void> => {
    const cnllSource = await dbApi.source.getByName({ name: "cnll" });

    if (!cnllSource || cnllSource.kind !== "CNLL") {
        console.warn(`This source if not compatible with CNLL Adapter : ${JSON.stringify(cnllSource, null, 2)}`);
        return;
    }

    const cnllProviders = await getCnllPrestatairesSill();

    const toInsert = cnllProviders.map(provider => ({
        sourceSlug: cnllSource.slug,
        externalId: provider.sill_id.toString(),
        softwareId: provider.sill_id
    }));

    await dbApi.softwareExternalData.saveMany(toInsert);
};

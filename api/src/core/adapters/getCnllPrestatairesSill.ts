// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { z } from "zod";
import { zCnllPrestatairesSill, type GetCnllPrestatairesSill } from "../ports/GetCnllPrestatairesSill";

const url = "https://annuaire.cnll.fr/api/prestataires-sill.json";

export const getCnllPrestatairesSill: GetCnllPrestatairesSill = memoize(
    async () => {
        try {
            console.info("Fetching cnll prestataires sill");
            const res = await fetch(url);

            if (res.status !== 200) {
                throw new Error(`Failed to fetch ${url}`);
            }
            const text = await res.text();

            const json = JSON.parse(text);

            return z.array(zCnllPrestatairesSill).parse(json);
        } catch (error) {
            console.error(`Failed to fetch or parse ${url}: ${String(error)}`);
            return [];
        }
    },
    { "promise": true }
);

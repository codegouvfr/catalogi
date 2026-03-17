// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

import { describe, it, expect } from "vitest";
import { getOrganisationFromApi } from "./getOrganisation";

describe("getOrganizationFromApi (live test)", () => {
    it("should fetch and convert a real Wikidata entity to a SchemaOrganization", async () => {
        // Utilise un ID d'entité Wikidata valide
        const entityId = "Q280413";

        // Appelle la fonction qui fait l'appel API réel
        const result = await getOrganisationFromApi({ entityId });

        // Vérifie que le résultat est bien un objet SchemaOrganization
        expect(result).toBeDefined();
        if (result) {
            expect(result["@type"]).toBe("Organization");
            expect(result.name).toEqual("Centre national de la recherche scientifique");
            expect(result.description).toEqual("organisme public français de recherche scientifique");
            expect(result.url).toEqual("https://www.cnrs.fr/");
            expect(result.foundingDate).toEqual("1939");
            expect(result.address).toEqual({
                "@type": "PostalAddress",
                "addressCountry": "France",
                "postalCode": "75794 cedex 16",
                "streetAddress": "3 rue Michel-Ange"
            });
        }
    }, 10000); // Augmente le timeout si nécessaire (en ms)
});

describe("getOrganizationFromApi (live test)", () => {
    it("should fetch and convert a real Wikidata entity to a SchemaOrganization", async () => {
        // Utilise un ID d'entité Wikidata valide
        const entityId = "Q70571774";

        // Appelle la fonction qui fait l'appel API réel
        const result = await getOrganisationFromApi({ entityId });

        // Vérifie que le résultat est bien un objet SchemaOrganization
        expect(result).toBeDefined();
        if (result) {
            expect(result["@type"]).toBe("Organization");
            expect(result.name).toEqual(
                "Institut national de recherche pour l'agriculture, l'alimentation et l'environnement"
            );
            expect(result.description).toEqual("institut français de recherche public");
            expect(result.url).toEqual("https://www.inrae.fr/");
            expect(result.foundingDate).toEqual("2020");
            expect(result.address).toEqual({
                "@type": "PostalAddress",
                "addressCountry": "France",
                "postalCode": "75007",
                "streetAddress": "147, rue de l'Université"
            });
        }
    }, 10000); // Augmente le timeout si nécessaire (en ms)
});

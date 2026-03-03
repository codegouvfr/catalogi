import { fetchRorOrganizationById } from "./getOrganization";
import { describe, expect, it } from "vitest";

describe("fetchRorOrganizationById - Integration Tests", () => {
    // Utilisez un ID ROR valide pour les tests
    const validRorId = "02feahw73"; // Remplacez par un ID ROR valide connu
    const invalidRorId = "invalid_id";

    it("should return a SchemaOrganization for a valid ROR ID", async () => {
        const result = await fetchRorOrganizationById(validRorId);

        // Vérifiez que le résultat n'est pas null
        expect(result).not.toBeNull();

        // Vérifiez les propriétés de base
        // expect(result).toHaveProperty('id', validRorId); // TODO
        expect(result).toHaveProperty("name", "Centre national de la recherche scientifique");
        expect(result).toHaveProperty("foundingDate", "1939");

        // Vérifiez les liens (sameAs)
        expect(result?.sameAs).toBeDefined();
        expect(result?.sameAs).toContainEqual(
            expect.objectContaining({
                type: "website",
                value: "https://www.cnrs.fr"
            })
        );

        // TODO
        expect(result?.sameAs).toContainEqual(
            expect.objectContaining({
                type: "wikipedia",
                value: "http://en.wikipedia.org/wiki/Centre_national_de_la_recherche_scientifique"
            })
        );

        // Vérifiez les identifiants externes (identifiers)
        expect(result?.identifiers).toBeDefined();
        expect(result?.identifiers).toContainEqual(
            expect.objectContaining({
                "@type": "PropertyValue",
                propertyID: "grid",
                url: expect.stringContaining("grid.org")
            })
        );

        // Vérifiez les relations (memberOf)
        expect(result?.memberOf).toBeDefined();
        expect(Array.isArray(result?.memberOf)).toBe(true);
        expect(result?.memberOf?.length).toBeGreaterThan(0);
    });

    it("should return null for an invalid ROR ID", async () => {
        const result = await fetchRorOrganizationById(invalidRorId);

        // Vérifiez que le résultat est null pour un ID invalide
        expect(result).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
        // Utilisez un ID qui pourrait provoquer une erreur (par exemple, un ID malformé)
        const result = await fetchRorOrganizationById("malformed_id");

        // Vérifiez que le résultat est null en cas d'erreur
        expect(result).toBeNull();
    });
});

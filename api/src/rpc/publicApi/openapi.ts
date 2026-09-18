// SPDX-License-Identifier: MIT
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { catalogV2Schema } from "./schema";

export function createOpenApiDocument(): ReturnType<OpenApiGeneratorV3["generateDocument"]> {
    const registry = new OpenAPIRegistry();
    registry.registerPath({
        method: "get",
        path: "/v2/catalogi.json",
        operationId: "getCatalogV2",
        summary: "Télécharger le catalogue complet",
        description:
            "Export JSON public, sans authentification ni pagination. Inclut les logiciels déréférencés. " +
            "Les données peuvent être mises en cache pendant deux heures par le serveur. " +
            "Les champs optionnels sans valeur sont omis ; null n’est utilisé que lorsque le schéma le prévoit.",
        responses: {
            200: {
                description: "Tableau des logiciels enrichis avec les données de leurs sources.",
                content: {
                    "application/json": { schema: catalogV2Schema }
                }
            },
            302: { description: "Redirection vers l’instance configurée, le cas échéant." },
            500: { description: "L’export n’a pas pu être produit. Réessayer ultérieurement." }
        }
    });
    return new OpenApiGeneratorV3(registry.definitions).generateDocument({
        openapi: "3.0.3",
        info: {
            title: "API publique Catalogi",
            version: "2.0.0",
            description:
                "Utilisez cet export versionné pour synchroniser un annuaire ou réutiliser le catalogue. " +
                "Les ajouts compatibles peuvent enrichir la v2 ; les ruptures de contrat nécessitent une nouvelle version.\n\n" +
                "Les anciens exports `catalogi.json` et `sill.json` sont dépréciés mais restent disponibles. " +
                "Ils ne sont pas documentés ici : migrez vers `v2/catalogi.json`. " +
                "L’ancienne procédure tRPC `getSoftwares` a été supprimée. Les procédures tRPC du frontend ne constituent pas l’API publique d’intégration."
        },
        // Relative to openapi.json, so proxies and application subpaths need no configuration.
        servers: [{ url: "./" }]
    });
}

// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

interface ApiResponse {
    total_count: number;
    results: Array<Record<string, unknown>>;
    // Ajoute d'autres champs si nécessaire selon la structure de la réponse
}

interface ApiError {
    message: string;
    status: number;
}

/**
 * Récupère les données d'une structure depuis l'API du MESRI.
 * @param numeroNationalDeStructure Le numéro national de la structure (ex: "201221027H")
 * @returns Une promesse avec les données de la structure ou une erreur
 */
async function getStructureData(numeroNationalDeStructure: string): Promise<ApiResponse | ApiError> {
    const baseUrl = "https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog";
    const dataset = "fr-esr-repertoire-national-structures-recherche";
    const url = new URL(`${baseUrl}/datasets/${dataset}/records`);

    // Construction des paramètres de la requête
    url.searchParams.append("where", `numero_national_de_structure="${numeroNationalDeStructure}"`);
    url.searchParams.append("limit", "1");

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const data: ApiResponse = await response.json();
        return data;
    } catch (error) {
        return {
            message: error instanceof Error ? error.message : "Erreur inconnue",
            status: error instanceof Error && "status" in error ? (error.status as number) : 500
        };
    }
}

// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { identifersUtils } from "../../../../tools/identifiersTools";
import { SchemaOrganization, SchemaPostalAddress } from "../../dbApi/kysely/kysely.database";

type RNSROrganisation = {
    numero_national_de_structure: string;
    libelle: string;
    sigle: string;
    annee_de_creation: string;
    type_de_structure: string;
    code_de_type_de_structure: string;
    code_de_niveau_de_structure: string;
    site_web: string;
    adresse: string;
    code_postal: string;
    commune: string;
    nom_du_responsable: string[];
    prenom_du_responsable: string[];
    titre_du_responsable: string[];
    label_numero: string[];
    tutelles: string[];
    sigles_des_tutelles: string[];
    code_de_nature_de_tutelle: string[];
    nature_de_tutelle: string[];
    uai_des_tutelles: string[];
    siret_des_tutelles: string[];
    code_de_type_de_tutelle: string[];
    type_de_tutelle: string[];
    numero_de_structure_enfant: string[] | null;
    numero_de_structure_parent: string | null;
    numero_de_structure_historique: string | null;
    type_de_succession: string | null;
    code_de_type_de_succession: string | null;
    annee_d_effet_historique: string | null;
    code_domaine_scientifique: string[];
    domaine_scientifique: string[];
    code_panel_erc: string | null;
    panel_erc: string | null;
    fiche_rnsr: string;
};

type RNSRResponse = {
    total_count: number;
    results: Array<RNSROrganisation>;
};

const convertToSchemaOrganization = (organisation: RNSROrganisation): SchemaOrganization => {
    const address: SchemaPostalAddress = {
        "@type": "PostalAddress",
        addressCountry: "France",
        addressCountryCode: "FR",
        postalCode: organisation.code_postal,
        addressLocality: organisation.commune,
        streetAddress: organisation.adresse
    };

    const alternateName: string[] = organisation.sigle ? [organisation.sigle] : [];

    const parentOrganizations: SchemaOrganization[] = [];
    if (organisation.code_de_type_de_tutelle) {
        organisation.code_de_type_de_tutelle.forEach((code, index) => {
            if (code === "TUTE") {
                parentOrganizations.push({
                    "@type": "Organization",
                    name: organisation.tutelles[index],
                    alternateName: [organisation.sigles_des_tutelles[index]],
                    identifiers: [
                        identifersUtils.makeSIRENIdentifier({ SIREN: organisation.siret_des_tutelles[index] })
                    ]
                });
            }
        });
    }

    const schemaOrganization: SchemaOrganization = {
        "@type": "Organization",
        name: organisation.libelle,
        url: organisation.site_web,
        identifiers: [identifersUtils.makeRNSROrgaIdentifer({ rnrsId: organisation.numero_national_de_structure })],
        parentOrganizations: parentOrganizations.length > 0 ? parentOrganizations : undefined,
        foundingDate: organisation.annee_de_creation,
        alternateName: alternateName.length > 0 ? alternateName : undefined,
        address: address,
        additionalType: [organisation.type_de_structure]
    };

    return schemaOrganization;
};

const getOrganizationByRNSR = async (rnsrId: string): Promise<RNSRResponse> => {
    const url = `https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-structures-recherche-publiques-actives/records/?limit=10&offset=0&where=numero_national_de_structure%3A%22${rnsrId}%22`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`getOrganizationByRNSR : Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();

        return data;
    } catch (error) {
        console.error("getOrganizationByRNSR : Erreur lors de la récupération des données:", error);
        throw error;
    }
};

export const getOrganisationFromRNSRApi = async (params: {
    rnsrId: string;
}): Promise<SchemaOrganization | undefined> => {
    const { rnsrId } = params;
    const result = await getOrganizationByRNSR(rnsrId);
    if (result.total_count === 0) return undefined;
    if (result.total_count > 2) throw Error("Too much results");

    return convertToSchemaOrganization(result.results[0]);
};

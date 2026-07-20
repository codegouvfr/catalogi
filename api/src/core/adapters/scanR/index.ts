// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { identifersUtils } from "../../../tools/identifiersTools";
import { SourceGateway } from "../../ports/SourceGateway";
import { Source } from "../../usecases/readWriteSillData";
import { SchemaOrganization, SchemaPostalAddress } from "../dbApi/kysely/kysely.database";
import { makeScanRApi } from "./API";
import { AgretatedScanROrganization, DenormalizedInstitution, FullAddress, Link } from "./API/scanRType";

export type ScanRSourceGateway = SourceGateway & {
    organization: NonNullable<SourceGateway["organization"]>;
};

const convertScanRtoSchema = (org: AgretatedScanROrganization): SchemaOrganization => {
    const address = org.address?.filter(add => add.main)?.[0];

    return {
        "@type": "Organization",
        name: org.label["fr"],
        url: org.links?.filter((link: Link) => {
            return link.type === "website";
        })?.[0]?.url,
        identifiers: org.externalIds
            ?.filter(row => ["ror", "wikidata", "siren", "grid", "rnsr", "hal"].includes(row.type))
            .map(row => {
                switch (row.type) {
                    case "ror":
                        return identifersUtils.makeRorOrgaIdentifer({ rorId: row.id });
                    case "wikidata":
                        return identifersUtils.makeWikidataIdentifier({
                            wikidataId: row.id,
                            additionalType: "Organization"
                        });
                    case "siren":
                        return identifersUtils.makeSIRENIdentifier({ SIREN: row.id });
                    case "grid":
                        return identifersUtils.makeGridIdentifier({ gridId: row.id });
                    case "rnsr":
                        return identifersUtils.makeRNSROrgaIdentifer({ rnrsId: row.id });
                    case "hal":
                    default:
                        // TODO support "siret" and "idref" ?
                        throw new Error();
                }
            }),
        parentOrganizations: org.parents?.map(orga => convertScanRDenomtoSchema(orga.denormalized)),
        foundingDate: org.creationYear?.toString(),
        alternateName: org.acronym?.["default"] ? [org.acronym["default"]] : [],
        description: org.description?.["fr"] ?? "",
        address: address ? convertAdress(address) : undefined,
        memberOf: org.parentOf?.map(orga => convertScanRDenomtoSchema(orga.denormalized)),

        additionalType: org?.kind, // education, government, facility, funder

        image: undefined,
        producer: []
    };
};

const convertScanRDenomtoSchema = (inst: DenormalizedInstitution): SchemaOrganization => {
    return {
        "@type": "Organization",
        name: inst.label["fr"],
        url: undefined,
        identifiers: undefined,
        parentOrganizations: undefined,
        foundingDate: undefined,
        alternateName: inst.acronym?.["default"] ? [inst.acronym["default"]] : [],
        description: undefined,
        address: convertAdress(inst.mainAddress),
        memberOf: undefined,

        additionalType: inst?.kind, // education, government, facility, funder

        image: undefined,
        producer: []
    };
};

const convertAdress = (scanRAddress: FullAddress): SchemaPostalAddress => {
    return {
        "@type": "PostalAddress",
        addressCountry: scanRAddress.country,
        addressCountryCode: scanRAddress.iso3,
        addressRegion: scanRAddress.region,
        addressLocality: scanRAddress.city,
        postalCode: scanRAddress.postcode,
        streetAddress: scanRAddress.address,
        geo:
            scanRAddress?.gps?.lat && scanRAddress?.gps?.lon
                ? {
                      "@type": "GeoCoordinates",
                      latitude: scanRAddress.gps.lat,
                      longitude: scanRAddress.gps.lon
                  }
                : undefined
    };
};

export const scanRSourceGateway: ScanRSourceGateway = {
    sourceType: "ScanR",
    organization: {
        getOrganization: async (params: { organizationId: string; source?: Source }) => {
            const scanRApiAgent = makeScanRApi(params.source);
            const org = await scanRApiAgent.organizations.search(params.organizationId);
            if (!org) return;
            return convertScanRtoSchema(org);
        }
    }
};

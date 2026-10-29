// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { doiSource, identifersUtils, mergeDepuplicateIdentifierArray } from "../../tools/identifiersTools";
import { SchemaIdentifier } from "./dbApi/kysely/kysely.database";
import { makeZenodoApi } from "./zenodo/zenodoAPI";

interface DataValue {
    format: string;
    value: string | AdminValue;
}

interface AdminValue {
    handle: string;
    index: number;
    permissions: string;
}

interface URLValue {
    index: number;
    type: "URL";
    data: {
        format: string;
        value: string;
    };
    ttl: number;
    timestamp: string;
}

interface OtherValue {
    index: number;
    type: string;
    data: DataValue;
    ttl: number;
    timestamp: string;
}

type Value = URLValue | OtherValue;

interface Response {
    responseCode: number;
    handle: string;
    values: Value[];
}

const apiResolve = async (doiId: string): Promise<Response | undefined> => {
    // Get domain using code
    const url = `https://doi.org/api/handles/${doiId}`;

    const res = await fetch(url).catch(err => {
        console.error(err);
        throw new Error(undefined);
    });

    if (res.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return apiResolve(doiId);
    }

    if (res.status === 404) {
        return undefined;
    }

    return res.json();
};

export const resolveDOIIdentifier = async (doiIdentifier: SchemaIdentifier): Promise<SchemaIdentifier | undefined> => {
    if (doiIdentifier.subjectOf?.url.toString() !== "https://doi.org/") throw new Error();

    const res = await apiResolve(doiIdentifier.value);
    if (!res) return undefined;

    const urlValue = res.values.filter(value => value.type === "URL")[0] as URLValue;

    if (urlValue.data.value.includes("zenodo.org")) {
        if (urlValue.data.value.includes("record"))
            return identifersUtils.makeZenodoIdentifer({
                zenodoId: res.handle.split(".")[2],
                url: urlValue.data.value
            });
        if (urlValue.data.value.includes("doi")) {
            const zenodoApi = makeZenodoApi();
            const record = await zenodoApi.records.getByDOI(res.handle);

            if (record) {
                return identifersUtils.makeZenodoIdentifer({
                    zenodoId: record.conceptrecid.toString(),
                    url: record.links.parent
                });
            }
        }
    }

    return identifersUtils.makeGenericIdentifier({ value: res.handle, url: urlValue.data.value });
};

export const populateFromDOIIdentifiers = async (identifiers: SchemaIdentifier[]) => {
    const doiIdentifiers = identifiers.filter(identifier => identifier.subjectOf === doiSource);
    if (doiIdentifiers.length === 0) return identifiers;

    const resolvedIdentifers = (
        await Promise.all(doiIdentifiers.map(identifer => resolveDOIIdentifier(identifer)))
    ).filter(a => !!a);

    return mergeDepuplicateIdentifierArray(identifiers, resolvedIdentifers);
};

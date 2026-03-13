// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { convertSourceConfigToRequestInit } from "../../../../tools/sourceConfig";
import { Source } from "../../../usecases/readWriteSillData";
import { Zenodo } from "./type";

const ZENODO_API_API_TIMEOUT = 60 * 1000;

export const makeZenodoApi = (source: Source) => {
    const timeOutBreak = source?.configuration?.rateLimitRetryDuration ?? ZENODO_API_API_TIMEOUT;

    const getRecord = async (zenodoRecordId: number): Promise<Zenodo.Record | undefined> => {
        const url = `https://zenodo.org/api/records/${zenodoRecordId}`;

        const res = await fetch(url, convertSourceConfigToRequestInit(source.configuration)).catch(err => {
            console.error(err);
            throw new Error(err);
        });

        if (res.status === 404) {
            console.debug(`Could not find records : ${zenodoRecordId}`);
            return undefined;
        }

        if (res.status === 429) {
            await new Promise(resolve => setTimeout(resolve, timeOutBreak));
            return getRecord(zenodoRecordId);
        }

        return res.json();
    };
    const getRecordByDOI = async (zenodoDOI: string): Promise<Zenodo.Record | undefined> => {
        const url = `https://zenodo.org/doi/${zenodoDOI}`;

        const res = await fetch(url).catch(err => {
            console.error(err);
            throw new Error(err);
        });

        if (res.status === 404) {
            console.debug(`Could not find records : ${zenodoDOI}`);
            return undefined;
        }

        if (res.status === 429) {
            await new Promise(resolve => setTimeout(resolve, timeOutBreak));
            return getRecordByDOI(zenodoDOI);
        }

        if (url !== res.url) {
            const urlParsed = res.url.split("/");
            return getRecord(Number(urlParsed[urlParsed.length - 1]));
        }

        return undefined;
    };

    const getRecordByName = async (name: string, type: string): Promise<Zenodo.Response<Zenodo.Record>> => {
        const url = `https://zenodo.org/api/records?q=title:${name} AND type:${type}`;

        const res = await fetch(url).catch(err => {
            console.error(err);
            throw new Error(err);
        });

        if (res.status === 404) {
            throw new Error(`Could find endpoint`);
        }

        if (res.status === 429) {
            await new Promise(resolve => setTimeout(resolve, timeOutBreak));
            return getRecordByName(name, type);
        }

        return res.json();
    };

    const getAllSoftware = async (): Promise<Zenodo.Response<Zenodo.Record>> => {
        const url = `https://zenodo.org/api/records?q=type:software&size=100`;

        const res = await fetch(url).catch(err => {
            console.error(err);
            throw new Error(err);
        });

        if (res.status === 404) {
            throw new Error(`Could find endpoint`);
        }

        if (res.status === 429) {
            await new Promise(resolve => setTimeout(resolve, timeOutBreak));
            return getAllSoftware();
        }

        return res.json();
    };

    const getCommunities = async (zenodoRecordId: number): Promise<Zenodo.Response<Zenodo.Community> | undefined> => {
        const url = `https://zenodo.org/api/records/${zenodoRecordId}/communities`;

        const res = await fetch(url).catch(err => {
            console.error(err);
            throw new Error(err);
        });

        if (res.status === 404) {
            console.debug(`Could not find commuties for record : ${zenodoRecordId}`);
            return undefined;
        }

        if (res.status === 429) {
            await new Promise(resolve => setTimeout(resolve, timeOutBreak));
            return getCommunities(zenodoRecordId);
        }

        return res.json();
    };

    return {
        records: {
            get: getRecord,
            getByDOI: getRecordByDOI,
            getByNameAndType: getRecordByName,
            getCommunities: getCommunities,
            getAllSoftware: getAllSoftware
        }
    };
};

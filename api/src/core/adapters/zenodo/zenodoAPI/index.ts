// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { convertSourceConfigToRequestInit } from "../../../../tools/sourceConfig";
import { Source } from "../../../usecases/readWriteSillData";
import { formatDateToYYYMMDD } from "../../../utils";
import { Zenodo } from "./type";

const ZENODO_API_API_TIMEOUT = 60 * 1000;

const LOG = "[ZenodoWrapper]";

export const makeZenodoApi = (source?: Source) => {
    const timeOutBreak = source?.configuration?.rateLimitRetryDuration ?? ZENODO_API_API_TIMEOUT;
    const auth = source?.configuration?.auth;
    const config = convertSourceConfigToRequestInit(source?.configuration);

    const apiCall = async <T>(url: string): Promise<T | undefined> => {
        console.debug(`${LOG} Zenodo call ${url}`);

        const res = await fetch(url, config).catch(err => {
            console.error(err);
            throw new Error(err);
        });

        if (res.status === 403) {
            console.debug(`${LOG} Got ${res.status} Forbidden resolve the url : ${url}`);
            return undefined;
        }

        if (res.status === 404 || res.status === 410) {
            console.debug(`${LOG} Got ${res.status} Could not resolve the url : ${url}`);
            return undefined;
        }

        if (res.status === 429 || res.status > 500) {
            console.debug(`${LOG} Got ${res.status} let's take a break for 60s`);
            await new Promise(resolve => setTimeout(resolve, timeOutBreak));
            return apiCall(url);
        }

        if (res.status !== 200) {
            throw new Error(LOG + res.status.toString());
        }

        try {
            return res.json();
        } catch (err) {
            console.error(LOG, err);
            throw new Error(LOG + err);
        }
    };

    const getRecord = async (zenodoRecordId: number): Promise<Zenodo.Record | undefined> => {
        const url = `https://zenodo.org/api/records/${zenodoRecordId}`;

        return apiCall(url);
    };
    const getRecordByDOI = async (zenodoDOI: string): Promise<Zenodo.Record | undefined> => {
        const doiSplit = zenodoDOI.split("/");
        const doiReference = doiSplit[1].split(".");

        if (doiSplit[0] !== "10.5281" || doiReference[0] !== "zenodo")
            throw new Error(`${LOG} The doi (${zenodoDOI}) isn't valid.`);

        const url = `https://zenodo.org/api/records/${doiReference[1]}`;

        return apiCall(url);
    };

    const getRecordByName = async (name: string, type: string): Promise<Zenodo.Response<Zenodo.Record> | undefined> => {
        const url = `https://zenodo.org/api/records?q=title:${name} AND type:${type}`;

        return apiCall(url);
    };

    const getAllSoftware = async (params: {
        page?: number;
        date: Date;
    }): Promise<Zenodo.Response<Zenodo.Record> | undefined> => {
        const { page = 1 } = params;
        const size = auth ? 100 : 25;
        const formatedDate: string = formatDateToYYYMMDD(params.date);

        const url = `https://zenodo.org/api/records?q=type:software AND created:[${formatedDate} TO *]&size=${size}&page=${page}&sort=-mostrecent&all_versions=false`;

        return apiCall(url);
    };

    const getCommunities = async (zenodoRecordId: number): Promise<Zenodo.Response<Zenodo.Community> | undefined> => {
        const url = `https://zenodo.org/api/records/${zenodoRecordId}/communities`;

        return apiCall(url);
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

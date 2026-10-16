// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DbApiV2 } from "../ports/DbApiV2";
import type { Source } from "./readWriteSillData";

export type ForgeKind = Extract<Source["kind"], "GitHub" | "GitLab">;

export const isForgeKind = (kind: string | undefined): kind is ForgeKind => kind === "GitHub" || kind === "GitLab";

export type EnsureForgeSource = (params: { kind: ForgeKind; url: string | URL }) => Promise<Source | undefined>;

const logTitle = "[UC.ensureForgeSource]";

// The GitHub adapters only accept this exact url.
const gitHubSourceUrl = "https://github.com/";

// One source per forge instance, created the first time one of its repositories shows up.
// `url` is any url on the forge, only its origin is kept. Created sources have no
// configuration: an admin adds auth afterwards if the instance requires it.
export const makeEnsureForgeSource =
    (deps: { dbApi: DbApiV2 }): EnsureForgeSource =>
    async ({ kind, url }) => {
        const { dbApi } = deps;

        const origin = URL.parse(url)?.origin;
        if (!origin || !origin.startsWith("http")) return undefined;
        if (kind === "GitHub" && origin !== new URL(gitHubSourceUrl).origin) return undefined;

        const sources = await dbApi.source.getAll();
        const existing = sources.find(
            source => source.kind === kind && source.url !== "" && URL.parse(source.url)?.origin === origin
        );
        if (existing) return existing;

        const slug = new URL(origin).host.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const source = await dbApi.source.createIfMissing({
            slug,
            kind,
            url: kind === "GitHub" ? gitHubSourceUrl : origin
        });

        if (source.kind !== kind || URL.parse(source.url)?.origin !== origin) {
            console.error(`${logTitle} slug ${slug} is already used by another source, ${origin} not registered`);
            return undefined;
        }

        return source;
    };

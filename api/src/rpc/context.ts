// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createDecodeAccessToken, OidcParams } from "../tools/oidc";
import { type WithUserSubAndEmail } from "./user";

export type Context = {
    user?: WithUserSubAndEmail;
};

export async function createContextFactory(params: { oidcParams: Pick<OidcParams, "issuerUri"> }) {
    const { oidcParams } = params;

    const { decodeAccessToken } = await createDecodeAccessToken(oidcParams.issuerUri);

    async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
        const { authorization } = req.headers;

        if (!authorization) {
            return {};
        }

        const { sub, email } = decodeAccessToken({ authorizationHeaderValue: authorization });

        return { user: { sub: sub, email } };
    }

    return { createContext };
}

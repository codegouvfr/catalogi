// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { initTRPC, TRPCError } from "@trpc/server";
import * as fs from "fs";
import { join as pathJoin } from "path";
import superjson from "superjson";
import type { Equals, ReturnType } from "tsafe";
import { assert } from "tsafe/assert";
import { z } from "zod";
import { DbApiV2 } from "../core/ports/DbApiV2";
import { ExternalDataOrigin, GetSoftwareExternalData, Language } from "../core/ports/GetSoftwareExternalData";
import type { GetSoftwareExternalDataOptions } from "../core/ports/GetSoftwareExternalDataOptions";
import { UiConfig } from "../core/uiConfigSchema";
import type { UseCases } from "../core/usecases";
import {
    DeclarationFormData,
    InstanceFormData,
    Os,
    SoftwareFormData,
    SoftwareType
} from "../core/usecases/readWriteSillData";
import { getMonorepoRootPackageJson } from "../tools/getMonorepoRootPackageJson";
import { OidcParams } from "../tools/oidc";
import type { OptionalIfCanBeUndefined } from "../tools/OptionalIfCanBeUndefined";
import type { Context } from "./context";
import { WithUserSubAndEmail } from "./user";

export function createRouter(params: {
    dbApi: DbApiV2;
    useCases: UseCases;
    oidcParams: OidcParams;
    redirectUrl: string | undefined;
    externalSoftwareDataOrigin: ExternalDataOrigin;
    getSoftwareExternalDataOptions: GetSoftwareExternalDataOptions;
    getSoftwareExternalData: GetSoftwareExternalData;
    uiConfig: UiConfig;
}) {
    const {
        useCases,
        dbApi,
        oidcParams,
        redirectUrl,
        externalSoftwareDataOrigin: externalDataOrigin,
        getSoftwareExternalDataOptions,
        uiConfig
    } = params;

    const t = initTRPC.context<Context>().create({
        "transformer": superjson
    });

    const loggedProcedure = t.procedure.use(
        t.middleware(async opts => {
            const start = Date.now();

            const result = await opts.next();

            const durationMs = Date.now() - start;
            const meta = { "path": opts.path, "type": opts.type, durationMs };

            result.ok ? console.log("OK request timing:", meta) : console.error("Non-OK request timing", meta);

            return result;
        })
    );

    const router = t.router({
        "getRedirectUrl": loggedProcedure.query(() => redirectUrl),
        "getExternalSoftwareDataOrigin": loggedProcedure.query(() => externalDataOrigin),
        "getApiVersion": loggedProcedure.query(
            (() => {
                const out: string = JSON.parse(
                    fs.readFileSync(pathJoin(getMonorepoRootPackageJson(), "package.json")).toString("utf8")
                )["version"];

                return () => out;
            })()
        ),
        "getOidcParams": loggedProcedure.query(() => oidcParams),
        "getCurrentUser": loggedProcedure.query(({ ctx: { user } }): WithUserSubAndEmail => {
            if (!user) throw new TRPCError({ "code": "UNAUTHORIZED" });
            return user;
        }),
        "getUiConfig": loggedProcedure.query(() => uiConfig),
        "getMainSource": loggedProcedure.query(() => dbApi.source.getMainSource()),
        "getSoftwares": loggedProcedure.query(() => dbApi.software.getAll()),
        "getInstances": loggedProcedure.query(() => dbApi.instance.getAll()),
        "getExternalSoftwareOptions": loggedProcedure
            .input(
                z.object({
                    "queryString": z.string(),
                    "language": zLanguage
                })
            )
            .query(async ({ ctx: { user }, input }) => {
                if (user === undefined) {
                    //To prevent abuse.
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { queryString, language } = input;
                const mainSource = await dbApi.source.getMainSource();

                const [queryResults, softwareExternalDataIds] = await Promise.all([
                    getSoftwareExternalDataOptions({ queryString, language, source: mainSource }),
                    dbApi.software.getAllSillSoftwareExternalIds(mainSource.slug)
                ]);

                return queryResults.map(({ externalId, description, label, isLibreSoftware, sourceSlug }) => ({
                    externalId: externalId,
                    description: description,
                    label: label,
                    isInSill: softwareExternalDataIds.includes(externalId),
                    isLibreSoftware,
                    sourceSlug
                }));
            }),
        "getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources": loggedProcedure
            .input(
                z.object({
                    "externalId": z.string()
                })
            )
            .query(async ({ ctx: { user }, input }) => {
                if (user === undefined) {
                    //To prevent abuse.
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                return useCases.getSoftwareFormAutoFillDataFromExternalAndOtherSources({
                    externalId: input.externalId
                });
            }),
        "createSoftware": loggedProcedure
            .input(
                z.object({
                    "formData": zSoftwareFormData
                })
            )
            .mutation(async ({ ctx: { user: userInContext }, input }) => {
                if (userInContext === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { formData } = input;

                const existingSoftware = await dbApi.software.getByName(formData.softwareName.trim());

                if (existingSoftware) {
                    throw new TRPCError({
                        "code": "CONFLICT",
                        "message": `Software already exists with name : ${formData.softwareName.trim()}`
                    });
                }

                try {
                    const user = await dbApi.user.getByEmail(userInContext.email);
                    let userId = user?.id as number;
                    if (!user) {
                        userId = await dbApi.user.add({
                            email: userInContext.email,
                            sub: userInContext.sub,
                            organization: null,
                            about: undefined,
                            isPublic: false
                        });
                    }

                    await dbApi.software.create({
                        formData,
                        userId
                    });
                } catch (e) {
                    throw new TRPCError({
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": String(e)
                    });
                }
            }),
        "updateSoftware": loggedProcedure
            .input(
                z.object({
                    "softwareSillId": z.number(),
                    "formData": zSoftwareFormData
                })
            )
            .mutation(async ({ ctx: { user: userInContext }, input }) => {
                if (userInContext === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { softwareSillId, formData } = input;

                const user = await dbApi.user.getByEmail(userInContext.email);
                if (!user)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "User not found"
                    });

                await dbApi.software.update({
                    softwareSillId,
                    formData,
                    userId: user.id
                });
            }),
        "createUserOrReferent": loggedProcedure
            .input(
                z.object({
                    "formData": zDeclarationFormData,
                    "softwareId": z.number()
                })
            )
            .mutation(async ({ ctx: { user: userInContext }, input }) => {
                if (userInContext === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { formData, softwareId } = input;

                const software = await dbApi.software.getById(softwareId);
                if (!software)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "Software not found"
                    });

                const user = await dbApi.user.getByEmail(userInContext.email);
                let userId = user?.id as number;
                if (!user) {
                    userId = await dbApi.user.add({
                        email: userInContext.email,
                        organization: null,
                        about: undefined,
                        isPublic: false,
                        sub: userInContext.sub
                    });
                }

                switch (formData.declarationType) {
                    case "user":
                        await dbApi.softwareUser.add({
                            softwareId,
                            userId,
                            os: formData.os ?? null,
                            serviceUrl: formData.serviceUrl ?? null,
                            useCaseDescription: formData.usecaseDescription,
                            version: formData.version
                        });
                        break;
                    case "referent":
                        await dbApi.softwareReferent.add({
                            softwareId,
                            userId,
                            isExpert: formData.isTechnicalExpert,
                            useCaseDescription: formData.usecaseDescription,
                            serviceUrl: formData.serviceUrl ?? null
                        });
                        break;
                }
            }),

        "removeUserOrReferent": loggedProcedure
            .input(
                z.object({
                    "softwareId": z.number(),
                    "declarationType": z.enum(["user", "referent"])
                })
            )
            .mutation(async ({ ctx: { user: userInContext }, input }) => {
                if (userInContext === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { softwareId, declarationType } = input;

                const user = await dbApi.user.getByEmail(userInContext.email);
                if (!user)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "User not found"
                    });

                const software = await dbApi.software.getById(softwareId);
                if (!software)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "Software not found"
                    });

                switch (declarationType) {
                    case "user": {
                        await dbApi.softwareUser.remove({
                            softwareId,
                            userId: user.id
                        });
                        break;
                    }

                    case "referent": {
                        await dbApi.softwareReferent.remove({
                            softwareId,
                            userId: user.id
                        });
                        break;
                    }
                }

                const [
                    numberOfSoftwareWhereThisUserIsUser,
                    numberOfSoftwareWhereThisUserIsReferent,
                    numberOfSoftwareAddedByThisUser,
                    numberOfInstanceAddedByThisUser
                ] = await Promise.all([
                    dbApi.softwareUser.countSoftwaresForUser({ userId: user.id }),
                    dbApi.softwareReferent.countSoftwaresForUser({ userId: user.id }),
                    dbApi.software.countAddedByUser({ userId: user.id }),
                    dbApi.instance.countAddedByUser({ userId: user.id })
                ]);

                if (
                    numberOfSoftwareWhereThisUserIsReferent === 0 &&
                    numberOfSoftwareWhereThisUserIsUser === 0 &&
                    numberOfSoftwareAddedByThisUser === 0 &&
                    numberOfInstanceAddedByThisUser === 0
                ) {
                    await dbApi.user.remove(user.id);
                }
            }),

        "createInstance": loggedProcedure
            .input(
                z.object({
                    "formData": zInstanceFormData
                })
            )
            .mutation(async ({ ctx: { user: userInContext }, input }) => {
                if (userInContext === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const user = await dbApi.user.getByEmail(userInContext.email);
                if (!user)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "User not found"
                    });
                const { formData } = input;

                const instanceId = await dbApi.instance.create({
                    formData,
                    userId: user.id
                });

                return { instanceId };
            }),
        "updateInstance": loggedProcedure
            .input(
                z.object({
                    "instanceId": z.number(),
                    "formData": zInstanceFormData
                })
            )
            .mutation(async ({ ctx: { user: userInContext }, input }) => {
                if (userInContext === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { instanceId, formData } = input;

                await dbApi.instance.update({
                    formData,
                    instanceId
                });
            }),
        "getUsers": loggedProcedure.query(async ({ ctx: { user } }) => {
            if (user === undefined) {
                throw new TRPCError({ "code": "UNAUTHORIZED" });
            }
            const users = await dbApi.user.getAll();
            return { users };
        }),
        "updateUserProfile": loggedProcedure
            .input(
                z.object({
                    "isPublic": z.boolean().optional(),
                    "about": z.string().optional(),
                    "newOrganization": z.string().optional()
                })
            )
            .mutation(async ({ ctx: { user: userInContext }, input }) => {
                if (userInContext === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { isPublic, newOrganization, about } = input;

                const user = await dbApi.user.getByEmail(userInContext.email);
                if (!user)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "User not found"
                    });
                await dbApi.user.update({
                    ...user,
                    ...(isPublic !== undefined ? { isPublic } : {}),
                    ...(newOrganization ? { organization: newOrganization } : {}),
                    ...(about ? { about } : {})
                });
            }),
        "getIsUserProfilePublic": loggedProcedure
            .input(
                z.object({
                    "email": z.string()
                })
            )
            .query(async ({ input }) => {
                const { email } = input;

                const user = await dbApi.user.getByEmail(email);

                return { isPublic: user?.isPublic ?? false };
            }),
        "getUser": loggedProcedure
            .input(
                z.object({
                    "email": z.string()
                })
            )
            .query(async ({ ctx: { user: userInContext }, input }) =>
                useCases.getUser({
                    email: input.email,
                    currentUser: userInContext
                })
            ),
        "getAllOrganizations": loggedProcedure.query(() => dbApi.user.getAllOrganizations()),
        "updateEmail": loggedProcedure
            .input(
                z.object({
                    "newEmail": z.string().email()
                })
            )
            .mutation(async ({ ctx: { user: userInContext }, input }) => {
                if (userInContext === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { newEmail } = input;

                const user = await dbApi.user.getByEmail(userInContext.email);
                if (!user)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "User not found"
                    });
                await dbApi.user.update({ ...user, email: newEmail });
            }),
        "getRegisteredUserCount": loggedProcedure.query(async () => dbApi.user.countAll()),
        "getTotalReferentCount": loggedProcedure.query(async () => {
            const referentCount = await dbApi.softwareReferent.getTotalCount();
            return { referentCount };
        }),
        "unreferenceSoftware": loggedProcedure
            .input(
                z.object({
                    "softwareId": z.number(),
                    "reason": z.string()
                })
            )
            .mutation(async ({ ctx: { user }, input }) => {
                if (user === undefined) {
                    throw new TRPCError({ "code": "UNAUTHORIZED" });
                }

                const { softwareId, reason } = input;

                await dbApi.software.unreference({
                    softwareId,
                    reason,
                    time: Date.now()
                });
            })
    });

    return { router };
}

export type TrpcRouter = ReturnType<typeof createRouter>["router"];

const zSoftwareType = z.union([
    z.object({
        "type": z.literal("desktop/mobile"),
        "os": z.object({
            "windows": z.boolean(),
            "linux": z.boolean(),
            "mac": z.boolean(),
            "android": z.boolean(),
            "ios": z.boolean()
        })
    }),
    z.object({
        "type": z.literal("cloud")
    }),
    z.object({
        "type": z.literal("stack")
    })
]);

{
    type Got = ReturnType<(typeof zSoftwareType)["parse"]>;
    type Expected = SoftwareType;

    assert<Equals<Got, Expected>>();
}

const zOs = z.enum(["windows", "linux", "mac", "android", "ios"]);

{
    type Got = ReturnType<(typeof zOs)["parse"]>;
    type Expected = Os;

    assert<Equals<Got, Expected>>();
}

const zSoftwareFormData = (() => {
    const zOut = z.object({
        "softwareType": zSoftwareType,
        "externalIdForSource": z.string().optional(),
        "sourceSlug": z.string(),
        "comptoirDuLibreId": z.number().optional(),
        "softwareName": z.string(),
        "softwareDescription": z.string(),
        "softwareLicense": z.string(),
        "softwareMinimalVersion": z.string().optional(),
        "isPresentInSupportContract": z.boolean(),
        "isFromFrenchPublicService": z.boolean(),
        "similarSoftwareExternalDataIds": z.array(z.string()),
        "softwareLogoUrl": z.string().optional(),
        "softwareKeywords": z.array(z.string()),
        "doRespectRgaa": z.boolean().or(z.null())
    });

    {
        type Got = ReturnType<(typeof zOut)["parse"]>;
        type Expected = OptionalIfCanBeUndefined<SoftwareFormData>;

        assert<Equals<Got, Expected>>();
    }

    return zOut as z.ZodType<SoftwareFormData>;
})();

const zDeclarationFormData = (() => {
    const zUser = z.object({
        "declarationType": z.literal("user"),
        "usecaseDescription": z.string(),
        "os": zOs.optional(),
        "version": z.string(),
        "serviceUrl": z.string().optional()
    });

    {
        type Got = ReturnType<(typeof zUser)["parse"]>;
        type Expected = OptionalIfCanBeUndefined<DeclarationFormData.User>;

        assert<Equals<Got, Expected>>();
    }

    const zReferent = z.object({
        "declarationType": z.literal("referent"),
        "isTechnicalExpert": z.boolean(),
        "usecaseDescription": z.string(),
        "serviceUrl": z.string().optional()
    });

    {
        type Got = ReturnType<(typeof zReferent)["parse"]>;
        type Expected = OptionalIfCanBeUndefined<DeclarationFormData.Referent>;

        assert<Equals<Got, Expected>>();
    }

    return z.union([zUser, zReferent]) as z.ZodType<DeclarationFormData>;
})();

const zInstanceFormData = (() => {
    const zOut = z.object({
        "mainSoftwareSillId": z.number(),
        "organization": z.string(),
        "targetAudience": z.string(),
        "instanceUrl": z.string().optional(),
        "isPublic": z.boolean()
    });

    {
        type Got = ReturnType<(typeof zOut)["parse"]>;
        type Expected = OptionalIfCanBeUndefined<InstanceFormData>;

        assert<Equals<Got, Expected>>();
    }

    return zOut as z.ZodType<InstanceFormData>;
})();

const zLanguage = z.union([z.literal("fr"), z.literal("en")]);

{
    type Got = ReturnType<(typeof zLanguage)["parse"]>;
    type Expected = Language;

    assert<Equals<Got, Expected>>();
}

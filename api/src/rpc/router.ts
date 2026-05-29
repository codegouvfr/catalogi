// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { initTRPC, TRPCError } from "@trpc/server";
import * as Sentry from "@sentry/node";
import superjson from "superjson";
import type { Equals, ReturnType } from "tsafe";
import { assert } from "tsafe/assert";
import { z } from "zod";
import type { DbApiV2 } from "../core/ports/DbApiV2";
import { Language } from "../core/ports/GetSoftwareExternalData";
import { UiConfig } from "../core/uiConfigSchema";
import type { UseCases } from "../core/usecases";
import {
    DeclarationFormData,
    InstanceFormData,
    SoftwareFormData,
    UserWithId
} from "../core/usecases/readWriteSillData";
import type { Os, RuntimePlatform } from "../core/types";
import { projectVersion } from "../tools/projectVersion";
import type { OptionalIfCanBeUndefined } from "../tools/OptionalIfCanBeUndefined";
import type { Context } from "./context";
import type { OidcParams } from "../core/usecases/auth/oidcClient";
import { resolveAdapterFromSource } from "../core/adapters/resolveAdapter";
import { softwareExternalDataOptionSchema } from "../core/ports/GetSoftwareExternalDataOptions";
import { sanitizeSoftwareFormDataCustomAttributes } from "../core/usecases/sanitizeSoftwareFormDataCustomAttributes";

export type UseCasesUsedOnRouter = Pick<
    UseCases,
    | "getUser"
    | "getSoftwareFormAutoFillDataFromExternalAndOtherSources"
    | "createSoftware"
    | "updateSoftware"
    | "fetchAndSaveExternalDataForOneSoftwarePackage"
    | "auth"
>;

export function createRouter(params: {
    dbApi: DbApiV2;
    useCases: UseCasesUsedOnRouter;
    oidcParams: OidcParams & { manageProfileUrl: string };
    redirectUrl: string | undefined;
    uiConfig: UiConfig;
}) {
    const { useCases, dbApi, oidcParams, redirectUrl, uiConfig } = params;

    const t = initTRPC.context<Context>().create({
        "transformer": superjson,
        errorFormatter({ shape, error }) {
            if (error.code === "INTERNAL_SERVER_ERROR" && error.cause) {
                Sentry.captureException(error.cause);
            } else if (error.code === "INTERNAL_SERVER_ERROR") {
                Sentry.captureException(error);
            }
            return shape;
        }
    });

    const sentryMiddleware = t.middleware(async opts => {
        try {
            return await opts.next();
        } catch (error) {
            if (error instanceof TRPCError && error.code !== "INTERNAL_SERVER_ERROR") {
                throw error;
            }

            Sentry.captureException(error, {
                contexts: {
                    trpc: {
                        path: opts.path,
                        type: opts.type,
                        input: opts.rawInput
                    }
                }
            });

            throw error;
        }
    });

    const loggedProcedure = t.procedure.use(sentryMiddleware).use(
        t.middleware(async opts => {
            const start = Date.now();

            const result = await opts.next();

            const durationMs = Date.now() - start;
            const meta = { "path": opts.path, "type": opts.type, durationMs };

            if (result.ok) {
                console.log("OK request timing:", meta);
            } else {
                console.error("Non-OK request timing", { meta, error: result.error });
            }

            return result;
        })
    );

    const protectedProcedure = loggedProcedure.use(
        t.middleware(async ({ ctx, next }) => {
            if (!ctx.currentUser) throw new TRPCError({ "code": "UNAUTHORIZED" });

            return next({
                ctx: {
                    ...ctx,
                    currentUser: ctx.currentUser
                }
            });
        })
    );

    const adminProcedure = protectedProcedure.use(
        t.middleware(async ({ ctx, next }) => {
            if (!ctx.currentUser || ctx.currentUser.role !== "admin") throw new TRPCError({ "code": "FORBIDDEN" });
            return next({
                ctx: {
                    ...ctx,
                    currentUser: ctx.currentUser
                }
            });
        })
    );

    const router = t.router({
        // PUBLIC PROCEDURES
        "getRedirectUrl": loggedProcedure.query(() => redirectUrl),
        "getExternalSoftwareDataOrigin": loggedProcedure.query(async () => (await dbApi.source.getMainSource()).kind),
        "getApiVersion": loggedProcedure.query(() => projectVersion),
        "getOidcManageProfileUrl": loggedProcedure.query(() => oidcParams.manageProfileUrl),
        "getUiConfig": loggedProcedure.query(async () => ({
            uiConfig,
            attributeDefinitions: await dbApi.attributeDefinition.getAll()
        })),
        "getMainSource": loggedProcedure.query(() => dbApi.source.getMainSource()),
        "getSoftwareList": loggedProcedure.query(() => {
            return dbApi.software.getFullList();
        }),
        "getSoftwareDetails": loggedProcedure
            .input(z.object({ softwareId: z.number() }))
            .query(({ input }) => dbApi.software.getDetails(input.softwareId)),
        "getInstances": loggedProcedure.query(() => dbApi.instance.getAll()),
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
        "getAllOrganizations": loggedProcedure.query(() => dbApi.user.getAllOrganizations()),
        "getRegisteredUserCount": loggedProcedure.query(async () => dbApi.user.countAll()),
        "getTotalReferentCount": loggedProcedure.query(async () => {
            const referentCount = await dbApi.softwareReferent.getTotalCount();
            return { referentCount };
        }),
        "getCurrentUser": loggedProcedure.query(({ ctx: { currentUser } }): UserWithId | undefined => currentUser),

        // -------------- PROTECTED PROCEDURES --------------
        "getExternalSoftwareOptions": protectedProcedure
            .input(
                z.object({
                    "queryString": z.string(),
                    "language": zLanguage
                })
            )
            .query(async ({ input }) => {
                const { queryString, language } = input;
                const mainSource = await dbApi.source.getMainSource();
                const sourceGateway = resolveAdapterFromSource(mainSource);

                if (!sourceGateway.software?.getSoftwareOptions)
                    throw new Error("Getting option is not possible from a secondary source");

                const [queryResults, softwareExternalDataIds] = await Promise.all([
                    sourceGateway.software.getSoftwareOptions({ queryString, language, source: mainSource }),
                    dbApi.software.getAllSillSoftwareExternalIds(mainSource.slug)
                ]);

                return queryResults.map(({ externalId, description, name, isLibreSoftware, sourceSlug }) => ({
                    externalId: externalId,
                    description: description,
                    name: name,
                    registered: softwareExternalDataIds.includes(externalId),
                    isLibreSoftware,
                    sourceSlug
                }));
            }),
        "getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources": protectedProcedure
            .input(
                z.object({
                    "externalId": z.string()
                })
            )
            .query(async ({ input }) =>
                useCases.getSoftwareFormAutoFillDataFromExternalAndOtherSources({
                    externalId: input.externalId
                })
            ),
        "createSoftware": protectedProcedure
            .input(
                z.object({
                    "formData": zSoftwareFormData
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { formData } = input;

                const existingSoftware = await dbApi.software.getByName({ softwareName: formData.name.trim() });

                if (existingSoftware) {
                    throw new TRPCError({
                        "code": "CONFLICT",
                        "message": `Software already exists with name : ${formData.name.trim()}`
                    });
                }

                try {
                    const sanitizedFormData = await sanitizeSoftwareFormDataCustomAttributes({
                        dbApi,
                        formData,
                        isAdmin: currentUser.role === "admin"
                    });

                    const createdSoftwareId = await useCases.createSoftware({
                        formData: sanitizedFormData,
                        userId: currentUser.id
                    });

                    await useCases.fetchAndSaveExternalDataForOneSoftwarePackage({ softwareId: createdSoftwareId });
                } catch (e) {
                    throw new TRPCError({
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": String(e)
                    });
                }
            }),
        "updateSoftware": protectedProcedure
            .input(
                z.object({
                    "softwareSillId": z.number(),
                    "formData": zSoftwareFormData
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { softwareSillId, formData } = input;

                const sanitizedFormData = await sanitizeSoftwareFormDataCustomAttributes({
                    dbApi,
                    formData,
                    isAdmin: currentUser.role === "admin",
                    softwareId: softwareSillId
                });

                await useCases.updateSoftware({
                    softwareId: softwareSillId,
                    formData: sanitizedFormData,
                    userId: currentUser.id
                });
            }),
        "createUserOrReferent": protectedProcedure
            .input(
                z.object({
                    "formData": zDeclarationFormData,
                    "softwareId": z.number()
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { formData, softwareId } = input;

                const software = await dbApi.software.getBySoftwareId(softwareId);
                if (!software)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "Software not found"
                    });

                switch (formData.declarationType) {
                    case "user":
                        await dbApi.softwareUser.add({
                            softwareId,
                            userId: currentUser.id,
                            os: formData.os ?? null,
                            serviceUrl: formData.serviceUrl ?? null,
                            useCaseDescription: formData.usecaseDescription,
                            version: formData.version
                        });
                        break;
                    case "referent":
                        await dbApi.softwareReferent.add({
                            softwareId,
                            userId: currentUser.id,
                            isExpert: formData.isTechnicalExpert,
                            useCaseDescription: formData.usecaseDescription,
                            serviceUrl: formData.serviceUrl ?? null
                        });
                        break;
                }
            }),

        "removeUserOrReferent": protectedProcedure
            .input(
                z.object({
                    "softwareId": z.number(),
                    "declarationType": z.enum(["user", "referent"])
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { softwareId, declarationType } = input;

                const software = await dbApi.software.getBySoftwareId(softwareId);
                if (!software)
                    throw new TRPCError({
                        "code": "NOT_FOUND",
                        message: "Software not found"
                    });

                switch (declarationType) {
                    case "user": {
                        await dbApi.softwareUser.remove({
                            softwareId,
                            userId: currentUser.id
                        });
                        break;
                    }

                    case "referent": {
                        await dbApi.softwareReferent.remove({
                            softwareId,
                            userId: currentUser.id
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
                    dbApi.softwareUser.countSoftwaresForUser({ userId: currentUser.id }),
                    dbApi.softwareReferent.countSoftwaresForUser({ userId: currentUser.id }),
                    dbApi.software.countAddedByUser({ userId: currentUser.id }),
                    dbApi.instance.countAddedByUser({ userId: currentUser.id })
                ]);

                if (
                    numberOfSoftwareWhereThisUserIsReferent === 0 &&
                    numberOfSoftwareWhereThisUserIsUser === 0 &&
                    numberOfSoftwareAddedByThisUser === 0 &&
                    numberOfInstanceAddedByThisUser === 0
                ) {
                    await dbApi.user.remove(currentUser.id);
                }
            }),

        "createInstance": protectedProcedure
            .input(
                z.object({
                    "formData": zInstanceFormData
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { formData } = input;

                const instanceId = await dbApi.instance.create({
                    formData,
                    userId: currentUser.id
                });

                return { instanceId };
            }),
        "updateInstance": protectedProcedure
            .input(
                z.object({
                    "instanceId": z.number(),
                    "formData": zInstanceFormData
                })
            )
            .mutation(async ({ input }) => {
                const { instanceId, formData } = input;

                await dbApi.instance.update({
                    formData,
                    instanceId
                });
            }),
        "getUsers": protectedProcedure.query(async () => {
            const users = await dbApi.user.getAll();
            return { users };
        }),
        "updateUserProfile": protectedProcedure
            .input(
                z.object({
                    "isPublic": z.boolean().optional(),
                    "about": z.string().optional(),
                    "newOrganization": z.string().optional()
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { isPublic, newOrganization, about } = input;

                await dbApi.user.update({
                    ...currentUser,
                    ...(isPublic !== undefined ? { isPublic } : {}),
                    ...(newOrganization ? { organization: newOrganization } : {}),
                    ...(about ? { about } : {})
                });
            }),
        "getUser": protectedProcedure
            .input(
                z.object({
                    "email": z.string()
                })
            )
            .query(async ({ ctx: { currentUser }, input }) =>
                useCases.getUser({
                    email: input.email,
                    currentUser
                })
            ),
        "updateEmail": protectedProcedure
            .input(
                z.object({
                    "newEmail": z.string().email()
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { newEmail } = input;

                await dbApi.user.update({ ...currentUser, email: newEmail });
            }),
        "unreferenceSoftware": protectedProcedure
            .input(
                z.object({
                    "softwareId": z.number(),
                    "reason": z.string()
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { softwareId, reason } = input;

                await dbApi.software.unreference({
                    softwareId,
                    reason,
                    time: new Date().toISOString(),
                    dereferencedByUserId: currentUser.id
                });
            }),

        "getAttributeDefinitions": loggedProcedure.query(() => dbApi.attributeDefinition.getAll()),

        "createAttributeDefinition": adminProcedure.input(zAttributeDefinitionCreate).mutation(async ({ input }) => {
            const existing = await dbApi.attributeDefinition.getByName(input.name);
            if (existing) {
                throw new TRPCError({
                    "code": "CONFLICT",
                    "message": `An attribute with name "${input.name}" already exists.`
                });
            }

            const all = await dbApi.attributeDefinition.getAll();
            const orderClash = all.find(a => a.displayOrder === input.displayOrder);
            if (orderClash) {
                throw new TRPCError({
                    "code": "CONFLICT",
                    "message": `Display order ${input.displayOrder} is already used by "${orderClash.name}".`
                });
            }

            const now = new Date();
            await dbApi.attributeDefinition.add({
                name: input.name,
                kind: input.kind,
                label: input.label,
                description: input.description,
                displayInForm: input.displayInForm,
                editableByAdminOnly: input.editableByAdminOnly,
                displayInDetails: input.displayInDetails,
                displayInCardIcon: input.displayInCardIcon,
                enableFiltering: input.enableFiltering,
                required: input.required,
                displayOrder: input.displayOrder,
                createdAt: now,
                updatedAt: now
            });
        }),

        "updateAttributeDefinition": adminProcedure.input(zAttributeDefinitionUpdate).mutation(async ({ input }) => {
            const { name, ...patch } = input;
            const existing = await dbApi.attributeDefinition.getByName(name);
            if (!existing) {
                throw new TRPCError({
                    "code": "NOT_FOUND",
                    "message": `No attribute with name "${name}".`
                });
            }
            if (patch.displayOrder !== undefined && patch.displayOrder !== existing.displayOrder) {
                const all = await dbApi.attributeDefinition.getAll();
                const orderClash = all.find(a => a.name !== name && a.displayOrder === patch.displayOrder);
                if (orderClash) {
                    throw new TRPCError({
                        "code": "CONFLICT",
                        "message": `Display order ${patch.displayOrder} is already used by "${orderClash.name}".`
                    });
                }
            }
            await dbApi.attributeDefinition.update(name, patch);
        })
    });

    return { router };
}

export type TrpcRouter = ReturnType<typeof createRouter>["router"];

const zOs = z.enum(["windows", "linux", "mac", "android", "ios"]);

{
    type Got = ReturnType<(typeof zOs)["parse"]>;
    type Expected = Os;

    assert<Equals<Got, Expected>>();
}

const zRuntimePlatform = z.enum(["cloud", "mobile", "desktop"]);

{
    type Got = ReturnType<(typeof zRuntimePlatform)["parse"]>;
    type Expected = RuntimePlatform;

    assert<Equals<Got, Expected>>();
}

const zSoftwareFormData = (() => {
    const nonEmptyString = z.string().min(1);
    const zOut: z.ZodType<OptionalIfCanBeUndefined<SoftwareFormData>> = z.object({
        "operatingSystems": z.record(zOs, z.boolean()),
        "runtimePlatforms": z.array(zRuntimePlatform),
        "externalIdForSource": z.string().optional(),
        "sourceSlug": z.string(),
        "name": nonEmptyString,
        "nameOverride": nonEmptyString.nullable(),
        "description": z.string().nullable(),
        "license": z.string().nullable(),
        "similarSoftwareExternalDataItems": z.array(softwareExternalDataOptionSchema),
        "image": z.string().nullable(),
        "keywords": z.array(z.string()),
        "customAttributes": z.record(z.string(), z.any()).optional(),
        "isLibreSoftware": z.boolean().nullable(),
        "url": z.string().nullable(),
        "codeRepositoryUrl": z.string().nullable(),
        "softwareHelp": z.string().nullable(),
        "latestVersion": z
            .object({
                "version": z.string().nullable(),
                "releaseDate": z.string().nullable()
            })
            .nullable(),
        "programmingLanguages": z.array(z.string()).optional()
    });

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

const zAttributeKind = z.enum(["boolean", "string", "number", "date", "url"]);
const zDisplayInCardIcon = z.enum(["computer", "france", "question", "thumbs-up", "chat", "star"]);
const zLocalizedString = z.record(z.string(), z.string());

const zAttributeDefinitionCreate = z.object({
    "name": z
        .string()
        .min(1)
        .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, "name must start with a letter and contain only alphanumeric characters"),
    "kind": zAttributeKind,
    "label": zLocalizedString,
    "description": zLocalizedString.optional(),
    "displayInForm": z.boolean(),
    "editableByAdminOnly": z.boolean().default(false),
    "displayInDetails": z.boolean(),
    "displayInCardIcon": zDisplayInCardIcon.optional(),
    "enableFiltering": z.boolean(),
    "required": z.boolean(),
    "displayOrder": z.number().int()
});

const zAttributeDefinitionUpdate = z.object({
    "name": z.string().min(1),
    "label": zLocalizedString.optional(),
    "description": zLocalizedString.optional(),
    "displayInForm": z.boolean().optional(),
    "editableByAdminOnly": z.boolean().optional(),
    "displayInDetails": z.boolean().optional(),
    "displayInCardIcon": zDisplayInCardIcon.optional(),
    "enableFiltering": z.boolean().optional(),
    "required": z.boolean().optional(),
    "displayOrder": z.number().int().optional()
});

const zLanguage = z.union([z.literal("fr"), z.literal("en")]);

{
    type Got = ReturnType<(typeof zLanguage)["parse"]>;
    type Expected = Language;

    assert<Equals<Got, Expected>>();
}

// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { initTRPC, TRPCError } from "@trpc/server";
import * as Sentry from "@sentry/node";
import superjson from "superjson";
import type { Equals, ReturnType } from "tsafe";
import { assert } from "tsafe/assert";
import { z } from "zod";
import { isHttpUrl } from "../tools/isHttpUrl";
import type { DbApiV2 } from "../core/ports/DbApiV2";
import { Language, type LocalizedString } from "../core/ports/GetSoftwareExternalData";
import {
    attributeDetailsSections,
    type AttributeDetailsSection
} from "../core/usecases/readWriteSillData/attributeTypes";
import { UiConfig, uiConfigSchema } from "../core/uiConfigSchema";
import type { UseCases } from "../core/usecases";
import {
    DeclarationFormData,
    InstanceFormData,
    SoftwareFormData,
    UserWithId
} from "../core/usecases/readWriteSillData";
import type { Os, RuntimePlatform } from "../core/types";
import type { SourceCategory } from "../core/adapters/dbApi/kysely/kysely.database";
import { projectVersion } from "../tools/projectVersion";
import type { OptionalIfCanBeUndefined } from "../tools/OptionalIfCanBeUndefined";
import type { Context } from "./context";
import type { OidcParams } from "../core/usecases/auth/oidcClient";
import { resolveAdapterFromSource } from "../core/adapters/resolveAdapter";
import { softwareExternalDataOptionSchema } from "../core/ports/GetSoftwareExternalDataOptions";
import { sanitizeSoftwareFormDataCustomAttributes } from "../core/usecases/sanitizeSoftwareFormDataCustomAttributes";
import { getInvalidCustomAttributeNames } from "../core/usecases/getInvalidCustomAttributeNames";
import {
    ProtectionReasonRequiredError,
    SoftwareAlreadyExistsError,
    SoftwareDereferencingProtectedError,
    SoftwareEditionProtectedError,
    SoftwareNotFoundError
} from "../core/usecases/softwareErrors";
import type { UpdateSourceParams } from "../core/usecases/adminSources";
import { maxSourceSettingMs } from "../core/usecases/sourceConfiguration";
import {
    InvalidCategoryOrderError,
    InvalidSourceConfigurationError,
    NotALookupSourceCandidateError,
    SourceNotEditableError,
    SourceNotFoundError
} from "../core/usecases/sourceErrors";

export type UseCasesUsedOnRouter = Pick<
    UseCases,
    | "getUser"
    | "getSoftwareFormAutoFillDataFromExternalAndOtherSources"
    | "createSoftware"
    | "updateSoftware"
    | "unreferenceSoftware"
    | "fetchAndSaveExternalDataForOneSoftwarePackage"
    | "resolveRepoUrl"
    | "adminSources"
    | "auth"
>;

export function createRouter(params: {
    dbApi: DbApiV2;
    useCases: UseCasesUsedOnRouter;
    oidcParams: OidcParams & { manageProfileUrl: string };
    redirectUrl: string | undefined;
}) {
    const { useCases, dbApi, oidcParams, redirectUrl } = params;

    const resolveUiConfig = async (): Promise<UiConfig> => {
        return dbApi.uiConfig.get();
    };

    const assertValidCustomAttributes = async (customAttributes: SoftwareFormData["customAttributes"]) => {
        const invalidNames = getInvalidCustomAttributeNames({
            attributeDefinitions: await dbApi.attributeDefinition.getAll(),
            customAttributes: customAttributes ?? {}
        });
        if (invalidNames.length > 0) {
            throw new TRPCError({
                "code": "BAD_REQUEST",
                "message": `Invalid value for custom attributes: ${invalidNames.join(", ")}.`
            });
        }
    };

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
                        // updateSource carries source credentials.
                        input: opts.path === "updateSource" ? "[redacted]" : opts.rawInput
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
        "getExternalSoftwareDataOrigin": loggedProcedure.query(async () => (await dbApi.source.getLookupSource()).kind),
        "getApiVersion": loggedProcedure.query(() => projectVersion),
        "getOidcManageProfileUrl": loggedProcedure.query(() => oidcParams.manageProfileUrl),
        "getUiConfig": loggedProcedure.query(async () => ({
            uiConfig: await resolveUiConfig(),
            attributeDefinitions: await dbApi.attributeDefinition.getAll()
        })),
        // The configuration holds credentials (forge tokens).
        "getLookupSource": loggedProcedure.query(async () => {
            const { configuration: _configuration, ...lookupSource } = await dbApi.source.getLookupSource();
            return lookupSource;
        }),
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
                const lookupSource = await dbApi.source.getLookupSource();
                const sourceGateway = resolveAdapterFromSource(lookupSource);

                if (!sourceGateway.software?.getSoftwareOptions)
                    throw new Error("Getting option is not possible from a secondary source");

                const [queryResults, softwareExternalDataIds] = await Promise.all([
                    sourceGateway.software.getSoftwareOptions({ queryString, language, source: lookupSource }),
                    dbApi.software.getAllSillSoftwareExternalIds(lookupSource.slug)
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
        "resolveRepoUrl": protectedProcedure
            .input(z.object({ "url": z.string() }))
            .query(({ ctx: { currentUser }, input }) =>
                useCases.resolveRepoUrl({ url: input.url, isAdmin: currentUser.role === "admin" })
            ),
        "createSoftware": protectedProcedure
            .input(
                z.object({
                    "formData": zSoftwareFormData
                })
            )
            .mutation(async ({ ctx: { currentUser }, input }) => {
                const { formData } = input;

                const uiConfig = await resolveUiConfig();
                if (!uiConfig.home.usecases.addSoftwareOrService.enabled && currentUser.role !== "admin") {
                    throw new TRPCError({
                        "code": "FORBIDDEN",
                        "message": "Adding software is disabled"
                    });
                }

                try {
                    const sanitizedFormData = await sanitizeSoftwareFormDataCustomAttributes({
                        dbApi,
                        formData,
                        isAdmin: currentUser.role === "admin"
                    });
                    await assertValidCustomAttributes(sanitizedFormData.customAttributes);

                    const createdSoftwareId = await useCases.createSoftware({
                        formData: sanitizedFormData,
                        userId: currentUser.id,
                        isAdmin: currentUser.role === "admin"
                    });

                    await useCases.fetchAndSaveExternalDataForOneSoftwarePackage({ softwareId: createdSoftwareId });
                } catch (e) {
                    if (e instanceof TRPCError) throw e;
                    if (e instanceof SoftwareAlreadyExistsError) {
                        throw new TRPCError({ "code": "CONFLICT", "message": e.message });
                    }
                    if (e instanceof ProtectionReasonRequiredError) {
                        throw new TRPCError({ "code": "BAD_REQUEST", "message": e.message });
                    }
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
                await assertValidCustomAttributes(sanitizedFormData.customAttributes);

                try {
                    await useCases.updateSoftware({
                        softwareId: softwareSillId,
                        formData: sanitizedFormData,
                        userId: currentUser.id,
                        isAdmin: currentUser.role === "admin"
                    });
                } catch (e) {
                    if (e instanceof SoftwareNotFoundError) {
                        throw new TRPCError({ "code": "NOT_FOUND", "message": e.message });
                    }
                    if (e instanceof SoftwareEditionProtectedError) {
                        throw new TRPCError({ "code": "FORBIDDEN", "message": e.message });
                    }
                    if (e instanceof ProtectionReasonRequiredError) {
                        throw new TRPCError({ "code": "BAD_REQUEST", "message": e.message });
                    }
                    throw e;
                }
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

                try {
                    await useCases.unreferenceSoftware({
                        softwareId,
                        reason,
                        userId: currentUser.id,
                        isAdmin: currentUser.role === "admin"
                    });
                } catch (e) {
                    if (e instanceof SoftwareNotFoundError) {
                        throw new TRPCError({ "code": "NOT_FOUND", "message": e.message });
                    }
                    if (e instanceof SoftwareDereferencingProtectedError) {
                        throw new TRPCError({ "code": "FORBIDDEN", "message": e.message });
                    }
                    throw e;
                }
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

            if ((input.kind === "enum") !== (input.options !== undefined)) {
                throw new TRPCError({
                    "code": "BAD_REQUEST",
                    "message": "options are required for enum attributes and only allowed for them"
                });
            }

            assertDetailsPlacement(input.detailsSection, input.detailsSubsection);

            const all = await dbApi.attributeDefinition.getAll();
            const now = new Date();
            await dbApi.attributeDefinition.add({
                name: input.name,
                kind: input.kind,
                label: input.label,
                description: input.description,
                options: input.options,
                displayInForm: input.displayInForm,
                editableByAdminOnly: input.editableByAdminOnly,
                displayInDetails: input.displayInDetails,
                detailsSection: input.detailsSection,
                detailsSubsection: input.detailsSubsection,
                displayInCardIcon: input.displayInCardIcon,
                enableFiltering: input.enableFiltering,
                required: input.required,
                displayOrder: Math.max(-1, ...all.map(def => def.displayOrder)) + 1,
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
            assertDetailsPlacement(
                patch.detailsSection ?? existing.detailsSection,
                patch.detailsSubsection === undefined
                    ? existing.detailsSubsection
                    : (patch.detailsSubsection ?? undefined)
            );
            if (patch.options !== undefined) {
                if (existing.kind !== "enum") {
                    throw new TRPCError({
                        "code": "BAD_REQUEST",
                        "message": `Only enum attributes have options, "${name}" is ${existing.kind}.`
                    });
                }
                const keptValues = new Set(patch.options.map(option => option.value));
                const removedUsedValues = (await dbApi.attributeDefinition.getUsedValues(name)).filter(
                    value => !keptValues.has(value)
                );
                if (removedUsedValues.length > 0) {
                    throw new TRPCError({
                        "code": "CONFLICT",
                        "message": `Options still used by softwares cannot be removed: ${removedUsedValues.join(", ")}.`
                    });
                }
            }
            await dbApi.attributeDefinition.update(name, patch);
        }),

        "reorderAttributeDefinitions": adminProcedure
            .input(z.object({ "names": z.array(z.string()) }))
            .mutation(async ({ input }) => {
                const existingNames = (await dbApi.attributeDefinition.getAll()).map(def => def.name);
                const names = new Set(input.names);
                if (names.size !== input.names.length || existingNames.sort().join() !== [...names].sort().join()) {
                    throw new TRPCError({
                        "code": "BAD_REQUEST",
                        "message": "names must list every attribute exactly once"
                    });
                }
                await dbApi.attributeDefinition.reorder(input.names);
            }),

        "updateUiConfig": adminProcedure.input(uiConfigSchema).mutation(async ({ input }) => {
            await dbApi.uiConfig.save(input);
            return input;
        }),

        "getAdminSources": adminProcedure.query(() => useCases.adminSources.getAll()),
        "updateSource": adminProcedure
            .input(zUpdateSource)
            .mutation(({ input }) => withSourceErrors(() => useCases.adminSources.update(input))),
        "setLookupSource": adminProcedure
            .input(z.object({ "slug": z.string() }))
            .mutation(({ input }) => withSourceErrors(() => useCases.adminSources.setLookupSource(input))),
        "reorderSourceCategories": adminProcedure
            .input(z.object({ "categories": z.array(zSourceCategory) }))
            .mutation(({ input }) => withSourceErrors(() => useCases.adminSources.reorderCategories(input))),
        "checkSourceConnection": adminProcedure
            .input(z.object({ "slug": z.string() }))
            .mutation(({ input }) => withSourceErrors(() => useCases.adminSources.checkConnection(input)))
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
        "protections": z
            .object({
                "dereferencing": z
                    .object({
                        "isProtected": z.boolean(),
                        "reason": z.string().nullable()
                    })
                    .optional(),
                "edition": z
                    .object({
                        "isProtected": z.boolean(),
                        "reason": z.string().nullable()
                    })
                    .optional()
            })
            .optional(),
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

const zOptionalHttpUrl = z
    .string()
    .refine(value => value === "" || isHttpUrl(value), "Expected an absolute HTTP or HTTPS URL")
    // Preserve empty strings: instance updates must not turn a clear into an omitted field.
    .optional();

const zDeclarationFormData = (() => {
    const zUser = z.object({
        "declarationType": z.literal("user"),
        "usecaseDescription": z.string(),
        "os": zOs.optional(),
        "version": z.string(),
        "serviceUrl": zOptionalHttpUrl
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
        "serviceUrl": zOptionalHttpUrl
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
        "instanceUrl": zOptionalHttpUrl,
        "isPublic": z.boolean()
    });

    {
        type Got = ReturnType<(typeof zOut)["parse"]>;
        type Expected = OptionalIfCanBeUndefined<InstanceFormData>;

        assert<Equals<Got, Expected>>();
    }

    return zOut as z.ZodType<InstanceFormData>;
})();

const zAttributeKind = z.enum(["boolean", "string", "number", "date", "url", "enum", "text"]);
const zDisplayInCardIcon = z.enum(["computer", "france", "question", "thumbs-up", "chat", "star"]);
const zLocalizedString = z.record(z.string(), z.string());

const zAttributeDetailsSection = z.enum(attributeDetailsSections);
const zDetailsSubsection = zLocalizedString.refine(title => Object.values(title).some(value => value.trim() !== ""), {
    "message": "subsection title must not be empty"
});

const assertDetailsPlacement = (section: AttributeDetailsSection, subsection: LocalizedString | undefined) => {
    if (section !== "summary" && subsection === undefined) {
        throw new TRPCError({
            "code": "BAD_REQUEST",
            "message": "a subsection title is required outside of the summary section"
        });
    }
};

const zAttributeOptions = z
    .array(
        z.object({
            "value": z
                .string()
                .regex(
                    /^[a-zA-Z][a-zA-Z0-9-]*$/,
                    "value must start with a letter and contain only letters, digits and hyphens"
                ),
            "label": zLocalizedString,
            "severity": z.enum(["success", "warning", "error", "info", "new"]).optional()
        })
    )
    .min(1)
    .refine(options => new Set(options.map(option => option.value)).size === options.length, {
        "message": "option values must be unique"
    });

const zAttributeDefinitionCreate = z.object({
    "name": z
        .string()
        .min(1)
        .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, "name must start with a letter and contain only alphanumeric characters"),
    "kind": zAttributeKind,
    "label": zLocalizedString,
    "description": zLocalizedString.optional(),
    "options": zAttributeOptions.optional(),
    "displayInForm": z.boolean(),
    "editableByAdminOnly": z.boolean().default(false),
    "displayInDetails": z.boolean(),
    "detailsSection": zAttributeDetailsSection.default("summary"),
    "detailsSubsection": zDetailsSubsection.optional(),
    "displayInCardIcon": zDisplayInCardIcon.optional(),
    "enableFiltering": z.boolean(),
    "required": z.boolean()
});

const zAttributeDefinitionUpdate = z.object({
    "name": z.string().min(1),
    "label": zLocalizedString.optional(),
    "description": zLocalizedString.nullable().optional(),
    "options": zAttributeOptions.optional(),
    "displayInForm": z.boolean().optional(),
    "editableByAdminOnly": z.boolean().optional(),
    "displayInDetails": z.boolean().optional(),
    "detailsSection": zAttributeDetailsSection.optional(),
    "detailsSubsection": zDetailsSubsection.nullable().optional(),
    "displayInCardIcon": zDisplayInCardIcon.optional(),
    "enableFiltering": z.boolean().optional(),
    "required": z.boolean().optional()
});

const withSourceErrors = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
        return await run();
    } catch (e) {
        if (e instanceof SourceNotFoundError) throw new TRPCError({ "code": "NOT_FOUND", "message": e.message });
        if (
            e instanceof SourceNotEditableError ||
            e instanceof InvalidSourceConfigurationError ||
            e instanceof InvalidCategoryOrderError ||
            e instanceof NotALookupSourceCandidateError
        ) {
            throw new TRPCError({ "code": "BAD_REQUEST", "message": e.message });
        }
        throw e;
    }
};

const zSourceCategory = z.enum([
    "UserInput",
    "repository",
    "wikidata",
    "HAL",
    "Zenodo",
    "ComptoirDuLibre",
    "CNLL",
    "ROR",
    "RNSR"
]);

{
    type Got = ReturnType<(typeof zSourceCategory)["parse"]>;
    type Expected = SourceCategory;

    assert<Equals<Got, Expected>>();
}

const zSourceSettingValue = z.number().int().positive().max(maxSourceSettingMs).nullable().optional();

const zUpdateSource = z.object({
    "slug": z.string(),
    "url": z.string().trim().optional(),
    "configuration": z
        .object({
            "settings": z
                .object({ "queryTimeout": zSourceSettingValue, "rateLimitRetryDuration": zSourceSettingValue })
                .strict()
                .optional(),
            "credential": z
                .discriminatedUnion("action", [
                    z.object({ "action": z.literal("replace"), "value": z.string().min(1) }),
                    z.object({ "action": z.literal("clear") })
                ])
                .optional()
        })
        .optional()
});

{
    type Got = ReturnType<(typeof zUpdateSource)["parse"]>;
    type Expected = UpdateSourceParams;

    assert<Equals<Got, Expected>>();
}

const zLanguage = z.union([z.literal("fr"), z.literal("en")]);

{
    type Got = ReturnType<(typeof zLanguage)["parse"]>;
    type Expected = Language;

    assert<Equals<Got, Expected>>();
}

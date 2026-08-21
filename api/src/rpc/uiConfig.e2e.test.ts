// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { DbApiV2 } from "../core/ports/DbApiV2";
import { getDefaultUiConfig } from "../core/defaultUiConfig";
import { resetDB, testPgUrl } from "../tools/test.helpers";
import { ApiCaller, createTestCaller, defaultUser } from "./createTestCaller";

describe("UI configuration RPC", () => {
    let apiCaller: ApiCaller;
    let dbApi: DbApiV2;
    let kyselyDb: Kysely<Database>;

    const adminUser: typeof defaultUser = {
        ...defaultUser,
        email: "ui-config.admin@example.com",
        role: "admin"
    };

    beforeAll(() => {
        kyselyDb = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
    });

    afterAll(async () => {
        await kyselyDb.destroy();
    });

    beforeEach(async () => {
        await resetDB(kyselyDb);
        ({ apiCaller, dbApi } = await createTestCaller({
            db: kyselyDb,
            currentUser: adminUser
        }));
    });

    it("initializes the database from the existing default configuration", async () => {
        await expect(dbApi.uiConfig.get()).resolves.toEqual(getDefaultUiConfig());
    });

    it("lets an admin persist a valid configuration", async () => {
        const { uiConfig } = await apiCaller.getUiConfig();
        const updatedConfig = {
            ...uiConfig,
            footer: { domains: [...uiConfig.footer.domains, "example.gouv.fr"] }
        };

        await expect(apiCaller.updateUiConfig(updatedConfig)).resolves.toEqual(updatedConfig);

        await expect(apiCaller.getUiConfig()).resolves.toMatchObject({
            uiConfig: updatedConfig
        });
    });

    it("preserves an admin configuration across application bootstraps", async () => {
        const { uiConfig } = await apiCaller.getUiConfig();
        const updatedConfig = {
            ...uiConfig,
            footer: { domains: ["persisted.example.gouv.fr"] }
        };
        await apiCaller.updateUiConfig(updatedConfig);

        const { apiCaller: restartedCaller } = await createTestCaller({
            db: kyselyDb,
            currentUser: undefined
        });

        await expect(restartedCaller.getUiConfig()).resolves.toMatchObject({
            uiConfig: updatedConfig
        });
    });

    it("forbids a regular user from updating the configuration", async () => {
        await resetDB(kyselyDb);
        const { apiCaller: regularUserCaller } = await createTestCaller({
            db: kyselyDb,
            currentUser: defaultUser
        });
        const { uiConfig } = await regularUserCaller.getUiConfig();

        await expect(regularUserCaller.updateUiConfig(uiConfig)).rejects.toThrow("FORBIDDEN");
    });

    it("requires authentication to update the configuration", async () => {
        const { apiCaller: anonymousCaller } = await createTestCaller({
            db: kyselyDb,
            currentUser: undefined
        });
        const { uiConfig } = await anonymousCaller.getUiConfig();

        await expect(anonymousCaller.updateUiConfig(uiConfig)).rejects.toThrow("UNAUTHORIZED");
    });

    it("rejects an invalid configuration read from the database", async () => {
        await kyselyDb
            .updateTable("config_ui")
            .set({
                config: JSON.stringify({
                    ...getDefaultUiConfig(),
                    unexpectedProperty: true
                })
            })
            .where("id", "=", true)
            .execute();

        await expect(apiCaller.getUiConfig()).rejects.toThrow("Unrecognized key(s)");
    });

    it("rejects unknown top-level properties instead of silently discarding them", async () => {
        const { uiConfig } = await apiCaller.getUiConfig();
        const invalidConfig = { ...uiConfig, unexpectedProperty: true };

        await expect(apiCaller.updateUiConfig(invalidConfig)).rejects.toThrow("Unrecognized key(s)");
        await expect(dbApi.uiConfig.get()).resolves.toEqual(uiConfig);
    });

    it("rejects unknown nested properties instead of silently discarding them", async () => {
        const { uiConfig } = await apiCaller.getUiConfig();
        const invalidConfig = {
            ...uiConfig,
            header: { ...uiConfig.header, unexpectedProperty: true }
        };

        await expect(apiCaller.updateUiConfig(invalidConfig)).rejects.toThrow("Unrecognized key(s)");
    });
});

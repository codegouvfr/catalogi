import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    readInitialUiConfig,
    STANDARD_UI_CONFIG
} from "./adapters/dbApi/kysely/migrations/1781768391060_add-config-ui-table";
import { uiConfigSchema } from "./uiConfigSchema";

describe("UI configuration deployment examples", () => {
    it("keeps the Docker Compose compatibility import valid", async () => {
        const path = resolve(__dirname, "../../../deployment-examples/docker-compose/customization/ui-config.json");
        const config = JSON.parse(await readFile(path, "utf8"));

        expect(() => uiConfigSchema.parse(config)).not.toThrow();
    });
});

describe("legacy UI configuration migration", () => {
    const temporaryDirectories: string[] = [];

    afterEach(async () => {
        await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
    });

    const createSimulatedImage = async () => {
        const apiRoot = await mkdtemp(join(tmpdir(), "catalogi-ui-config-migration-"));
        temporaryDirectories.push(apiRoot);

        return {
            sourceMigrationDirectory: resolve(apiRoot, "src/core/adapters/dbApi/kysely/migrations"),
            sourceConfigPath: resolve(apiRoot, "src/customization/ui-config.json"),
            distMigrationDirectory: resolve(apiRoot, "dist/src/core/adapters/dbApi/kysely/migrations"),
            distConfigPath: resolve(apiRoot, "dist/src/customization/ui-config.json")
        };
    };

    const writeConfig = async (path: string, config: unknown) => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, JSON.stringify(config), "utf8");
    };

    it("finds the dist mount when Kysely executes the migration from source", async () => {
        const { sourceMigrationDirectory, distConfigPath } = await createSimulatedImage();
        const legacyConfig = {
            ...STANDARD_UI_CONFIG,
            footer: { domains: ["legacy.example.gouv.fr"] }
        };
        await writeConfig(distConfigPath, legacyConfig);

        await expect(readInitialUiConfig(sourceMigrationDirectory)).resolves.toEqual(legacyConfig);
    });

    it("finds the source mount when the compiled migration is executed", async () => {
        const { distMigrationDirectory, sourceConfigPath } = await createSimulatedImage();
        const legacyConfig = {
            ...STANDARD_UI_CONFIG,
            footer: { domains: ["source.example.gouv.fr"] }
        };
        await writeConfig(sourceConfigPath, legacyConfig);

        await expect(readInitialUiConfig(distMigrationDirectory)).resolves.toEqual(legacyConfig);
    });

    it("uses the embedded standard only when neither legacy path exists", async () => {
        const { sourceMigrationDirectory } = await createSimulatedImage();

        await expect(readInitialUiConfig(sourceMigrationDirectory)).resolves.toEqual(STANDARD_UI_CONFIG);
    });

    it.each([
        ["malformed JSON", "{", "is not valid JSON"],
        ["an incompatible schema", JSON.stringify({ header: {} }), "is incompatible"]
    ])("rejects %s instead of falling back", async (_, serializedConfig, expectedMessage) => {
        const { sourceMigrationDirectory, sourceConfigPath } = await createSimulatedImage();
        await mkdir(dirname(sourceConfigPath), { recursive: true });
        await writeFile(sourceConfigPath, serializedConfig, "utf8");

        await expect(readInitialUiConfig(sourceMigrationDirectory)).rejects.toThrow(expectedMessage);
    });

    it("rejects an unreadable legacy path instead of falling back", async () => {
        const { sourceMigrationDirectory, sourceConfigPath } = await createSimulatedImage();
        await mkdir(sourceConfigPath, { recursive: true });

        await expect(readInitialUiConfig(sourceMigrationDirectory)).rejects.toThrow(
            "Unable to read legacy UI configuration"
        );
    });
});

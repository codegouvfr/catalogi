// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { env } from "../env";
import { startImportService } from "../rpc/import";
import commandLineArgs from "command-line-args";
import { readFileSync } from "fs";
import { resolve } from "path";

const optionDefinitions = [
    { name: "source", alias: "s", type: String, multiple: false, defaultOption: true },
    { name: "externalIdsToImport", alias: "e", type: String, multiple: true }
];

const options = commandLineArgs(optionDefinitions);

const parseExternalIds = (externalIdsInput: string | string[]): Promise<string[]> => {
    const inputs = Array.isArray(externalIdsInput) ? externalIdsInput : [externalIdsInput];

    const allIds: string[] = [];

    for (const input of inputs) {
        if (!input) continue;

        if (input.endsWith(".json") || input.startsWith("/") || input.startsWith("./")) {
            try {
                const filePath = resolve(input);
                const fileContent = readFileSync(filePath, "utf-8");
                const parsed = JSON.parse(fileContent);

                // Handle both {["id1","id2"]} and ["id1","id2"] formats
                if (Array.isArray(parsed)) {
                    allIds.push(...parsed);
                } else if (typeof parsed === "object" && parsed !== null) {
                    const listOfIds = parsed.ids || parsed.externalIds;
                    if (Array.isArray(listOfIds)) {
                        allIds.push(...listOfIds);
                    }
                }
            } catch (error) {
                console.error(`[Entrypoint:Import] Error reading file ${input}:`, error);
                throw error;
            }
        } else {
            // Treat as comma-separated string
            allIds.push(
                ...input
                    .split(",")
                    .map(id => id.trim())
                    .filter(id => id)
            );
        }
    }

    return Promise.resolve(allIds);
};

parseExternalIds(options.externalIdsToImport)
    .then(externalIds => {
        return startImportService({
            env,
            args: {
                sourceSlug: options.source,
                externalIdsToImport: externalIds
            }
        });
    })
    .then(() => console.info("[Entrypoint:Import] Import successful ✅ Closing import"))
    .catch(error => {
        console.error("[Entrypoint:Import] Error during import:", error);
        process.exit(1);
    });

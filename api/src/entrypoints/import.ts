// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { env } from "../env";
import { startImportService } from "../rpc/import";
import commandLineArgs from "command-line-args";

const optionDefinitions = [
    { name: "source", alias: "s", type: String, multiple: false, defaultOption: true },
    { name: "externalIdsToImport", alias: "e", type: String, multiple: true }
];

const options = commandLineArgs(optionDefinitions);

startImportService({
    env,
    args: {
        sourceSlug: options.source,
        externalIdsToImport: options.externalIdsToImport
    }
}).then(() => console.info("[Entrypoint:Import] Import sucessuful ✅ Closing import"));

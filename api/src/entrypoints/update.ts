// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { env } from "../env";
import { startUpdateService } from "../rpc/update";
import commandLineArgs from "command-line-args";

const optionDefinitions = [
    { name: "source", alias: "s", type: String, multiple: true, defaultOption: true },
    { name: "updateSkipTimingInMinutes", alias: "t", type: Number },
    { name: "softwareIdsToRefresh", alias: "w", type: Number, multiple: true }
];

const options = commandLineArgs(optionDefinitions);

startUpdateService({
    env,
    args: {
        sourceSlugs: options.source,
        updateSkipTimingInMinutes: options.updateSkipTimingInMinutes,
        updateSoftwareIds: options.softwareIdsToRefresh
    }
}).then(() => process.exit(0));

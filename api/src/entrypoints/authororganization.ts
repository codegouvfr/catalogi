// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { env } from "../env";
import { authorOrganizationUtils } from "../rpc/authororganization";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

let mainDefinitions = [{ name: "command", defaultOption: true }];
const mainCommand = commandLineArgs(mainDefinitions, { stopAtFirstUnknown: true });

const usage = commandLineUsage([
    {
        header: "authorOrganization",
        content: "CLI tool to mange automatic build of the software per orgnization (prune, build, rebuild)."
    },
    {
        header: "Synopsis",
        content: "$ authororganization <command>"
    },
    {
        header: "Command List",
        content: [
            {
                name: "build",
                summary: "Build the index of organization with developped software, skipping existing once"
            },
            { name: "prune", summary: "Prune the index of organization with developped software " },
            { name: "rebuild", summary: "Prune and build the index of organization with developped software" }
        ]
    },
    {
        header: "Options",
        optionList: [
            {
                name: "help",
                description: "Print this help."
            }
        ]
    }
]);

authorOrganizationUtils({ env, args: {} })
    .then(async utils => {
        if (mainCommand?.command) {
            switch (mainCommand.command) {
                case "prune":
                    return utils.prune();
                case "build":
                    return utils.build();
                case "rebuild":
                    return utils.rebuild();
                default:
                    console.log(usage);
                    return;
            }
        } else {
            console.log(usage);
            return;
        }
    })
    .then(() => process.exit(0))
    .catch();

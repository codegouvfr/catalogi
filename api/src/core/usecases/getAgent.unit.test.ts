// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "shared";
import { expectPromiseToFailWith, expectToEqual } from "../../tools/test.helpers";
import {
    AgentRepositoryHelpers,
    createInMemoryAgentRepository
} from "../adapters/dbApi/in-memory/createInMemoryAgentRepository";
import { AgentRepository, AgentWithId } from "../ports/DbApiV2";
import { GetAgent, makeGetAgent } from "./getAgent";

describe("getAgent", () => {
    const privateAgent: AgentWithId = {
        id: 1,
        email: "bob-private@mail.com",
        organization: "Truc",
        isPublic: false,
        about: "",
        declarations: []
    };

    const publicAgent: AgentWithId = {
        id: 2,
        email: "bob-public@mail.com",
        organization: "Truc",
        isPublic: true,
        about: "",
        declarations: []
    };

    const currentUser: User = {
        id: "user-id",
        email: "bob@mail.com"
    };

    let agentRepository: AgentRepository;
    let getAgent: GetAgent;
    let testHelpers: AgentRepositoryHelpers;

    beforeEach(() => {
        ({ agentRepository, testHelpers } = createInMemoryAgentRepository());
        getAgent = makeGetAgent({ agentRepository });
    });

    describe("when user is connected", () => {
        it("returns the agent when it exists", async () => {
            // GIVEN
            testHelpers.setAgents([privateAgent]);

            // WHEN
            const { agent } = await getAgent({
                email: privateAgent.email,
                currentUser: {
                    id: "user-id",
                    email: "some@mail.com"
                }
            });

            // THEN
            expectToEqual(agent, privateAgent);
        });

        it("creates an agent when no agent found, and user email matches searched email", async () => {
            testHelpers.setAgents([]);
            const { agent } = await getAgent({
                email: currentUser.email,
                currentUser
            });

            const expectedAgent: AgentWithId = {
                id: expect.any(Number),
                email: currentUser.email,
                organization: null,
                isPublic: false,
                about: "",
                declarations: []
            };

            const { declarations, ...expectedAgentWithoutDeclaration } = expectedAgent;

            expectToEqual(testHelpers.agents, [expectedAgentWithoutDeclaration]);
            expectToEqual(agent, expectedAgent);
        });

        it("throw Not Found when no agent found, and user email does NOT match searched email", async () => {
            testHelpers.setAgents([]);
            await expectPromiseToFailWith(
                getAgent({
                    email: "another@mail.com",
                    currentUser
                }),
                "Agent not found"
            );
        });
    });

    describe("when user is NOT connected", () => {
        it("throw Not Found if agent cannot be found", async () => {
            testHelpers.setAgents([]);
            await expectPromiseToFailWith(
                getAgent({
                    email: "another@mail.com",
                    currentUser: undefined
                }),
                "Agent not found"
            );
        });

        it("returns agent when it is public", async () => {
            testHelpers.setAgents([publicAgent]);

            const { agent } = await getAgent({
                email: publicAgent.email,
                currentUser: undefined
            });

            expectToEqual(agent, publicAgent);
        });

        it("throw Unauthorized if it is not public", async () => {
            testHelpers.setAgents([privateAgent]);

            await expectPromiseToFailWith(
                getAgent({
                    email: privateAgent.email,
                    currentUser: undefined
                }),
                "UNAUTHORIZED"
            );
        });
    });
});

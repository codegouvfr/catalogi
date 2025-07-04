// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from "vitest";
import { WithUserSubAndEmail } from "../../rpc/user";
import { expectPromiseToFailWith, expectToEqual } from "../../tools/test.helpers";
import {
    UserRepositoryHelpers,
    createInMemoryUserRepository
} from "../adapters/dbApi/in-memory/createInMemoryUserRepository";
import { UserRepository, UserWithId } from "../ports/DbApiV2";
import { GetUser, makeGetUser } from "./getUser";

describe("getAgent", () => {
    const privateUser: UserWithId = {
        id: 1,
        email: "bob-private@mail.com",
        organization: "Truc",
        isPublic: false,
        about: "",
        declarations: []
    };

    const publicUser: UserWithId = {
        id: 2,
        email: "bob-public@mail.com",
        organization: "Truc",
        isPublic: true,
        about: "",
        declarations: []
    };

    const currentUser: WithUserSubAndEmail = {
        sub: "user-id",
        email: "bob@mail.com"
    };

    let userRepository: UserRepository;
    let getUser: GetUser;
    let testHelpers: UserRepositoryHelpers;

    beforeEach(() => {
        ({ userRepository, testHelpers } = createInMemoryUserRepository());
        getUser = makeGetUser({ userRepository });
    });

    describe("when user is connected", () => {
        it("returns the agent when it exists", async () => {
            // GIVEN
            testHelpers.setUsers([privateUser]);

            // WHEN
            const { user } = await getUser({
                email: privateUser.email,
                currentUser: {
                    sub: "user-id",
                    email: "some@mail.com"
                }
            });

            // THEN
            expectToEqual(user, privateUser);
        });

        it("creates an agent when no agent found, and user email matches searched email", async () => {
            testHelpers.setUsers([]);
            const { user } = await getUser({
                email: currentUser.email,
                currentUser
            });

            const expectedAgent: UserWithId = {
                id: expect.any(Number),
                email: currentUser.email,
                organization: null,
                isPublic: false,
                about: "",
                declarations: []
            };

            const { declarations, ...expectedAgentWithoutDeclaration } = expectedAgent;

            expectToEqual(testHelpers.users, [expectedAgentWithoutDeclaration]);
            expectToEqual(user, expectedAgent);
        });

        it("throw Not Found when no agent found, and user email does NOT match searched email", async () => {
            testHelpers.setUsers([]);
            await expectPromiseToFailWith(
                getUser({
                    email: "another@mail.com",
                    currentUser
                }),
                "Agent not found"
            );
        });
    });

    describe("when user is NOT connected", () => {
        it("throw Not Found if user cannot be found", async () => {
            testHelpers.setUsers([]);
            await expectPromiseToFailWith(
                getUser({
                    email: "another@mail.com",
                    currentUser: undefined
                }),
                "Agent not found"
            );
        });

        it("returns user when it is public", async () => {
            testHelpers.setUsers([publicUser]);

            const { user } = await getUser({
                email: publicUser.email,
                currentUser: undefined
            });

            expectToEqual(user, publicUser);
        });

        it("throw Unauthorized if it is not public", async () => {
            testHelpers.setUsers([privateUser]);

            await expectPromiseToFailWith(
                getUser({
                    email: privateUser.email,
                    currentUser: undefined
                }),
                "UNAUTHORIZED"
            );
        });
    });
});

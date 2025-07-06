// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { beforeEach, describe, it } from "vitest";
import { expectPromiseToFailWith, expectToEqual } from "../../tools/test.helpers";
import {
    UserRepositoryHelpers,
    createInMemoryUserRepository
} from "../adapters/dbApi/in-memory/createInMemoryUserRepository";
import { UserRepository } from "../ports/DbApiV2";
import { GetUser, makeGetUser } from "./getUser";
import { UserWithId } from "./readWriteSillData/types";

describe("getUser", () => {
    const privateUser: UserWithId = {
        id: 1,
        email: "bob-private@mail.com",
        organization: "Truc",
        isPublic: false,
        about: "",
        declarations: [],
        sub: null
    };

    const publicUser: UserWithId = {
        id: 2,
        email: "bob-public@mail.com",
        organization: "Truc",
        isPublic: true,
        about: "",
        declarations: [],
        sub: null
    };

    const currentUser: UserWithId = {
        declarations: [],
        id: 10,
        isPublic: false,
        about: undefined,
        organization: null,
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
                currentUser
            });

            // THEN
            expectToEqual(user, privateUser);
        });

        it("throw Not Found when no agent found, and user email does NOT match searched email", async () => {
            testHelpers.setUsers([]);
            await expectPromiseToFailWith(
                getUser({
                    email: "another@mail.com",
                    currentUser
                }),
                "User not found"
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
                "User not found"
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

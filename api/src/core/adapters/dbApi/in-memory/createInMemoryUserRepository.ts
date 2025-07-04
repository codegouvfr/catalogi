// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { UserRepository, DbUser } from "../../../ports/DbApiV2";

type DbUserWithId = DbUser & Pick<DbUser, "id">;

export type UserRepositoryHelpers = {
    setUsers: (newUsers: DbUserWithId[]) => void;
    users: DbUserWithId[];
};

export const createInMemoryUserRepository = (): {
    userRepository: UserRepository;
    testHelpers: UserRepositoryHelpers;
} => {
    let id = 1;
    let users: DbUserWithId[] = [];

    return {
        userRepository: {
            add: async user => users.push({ id: id++, ...user }),
            update: _ => {
                throw new Error("Not implemented");
            },
            remove: _ => {
                throw new Error("Not implemented");
            },
            getByEmail: async email => {
                const user = users.find(user => user.email === email);
                if (!user) return;
                return { ...user, declarations: [] };
            },
            getAll: () => {
                throw new Error("Not implemented");
            },
            getAllOrganizations: () => {
                throw new Error("Not implemented");
            },
            countAll: async () => users.length
        },
        testHelpers: {
            setUsers: (newUsers: DbUserWithId[]) => {
                users.length = 0;
                users.push(...newUsers);
            },
            users
        }
    };
};

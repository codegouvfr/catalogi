// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { TRPCError } from "@trpc/server";
import { UserRepository } from "../ports/DbApiV2";
import { UserWithId } from "./readWriteSillData";

type GetUserDependencies = {
    userRepository: UserRepository;
};

type GetUserParams = {
    email: string;
    currentUser: UserWithId | undefined;
};

export type GetUser = ReturnType<typeof makeGetUser>;
export const makeGetUser =
    ({ userRepository }: GetUserDependencies) =>
    async ({ email, currentUser }: GetUserParams): Promise<{ user: UserWithId }> => {
        const user = await userRepository.getByEmail(email);

        if (!user)
            throw new TRPCError({
                "code": "NOT_FOUND",
                message: "User not found"
            });

        if (!currentUser && !user.isPublic)
            throw new TRPCError({
                "code": "UNAUTHORIZED"
            });

        return { user };
    };

// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { TRPCError } from "@trpc/server";
import { WithUserSubAndEmail } from "../../rpc/user";
import { UserRepository } from "../ports/DbApiV2";
import { UserWithId } from "./readWriteSillData";

type GetUserDependencies = {
    userRepository: UserRepository;
};

type GetUserParams = {
    email: string;
    currentUser: WithUserSubAndEmail | undefined;
};

export type GetUser = ReturnType<typeof makeGetUser>;
export const makeGetUser =
    ({ userRepository }: GetUserDependencies) =>
    async ({ email, currentUser }: GetUserParams): Promise<{ user: UserWithId }> => {
        const user = await userRepository.getByEmail(email);

        if (currentUser) {
            if (user) return { user };
            if (currentUser.email === email) {
                const userWithoutId = {
                    email: currentUser.email,
                    organization: null,
                    about: "",
                    isPublic: false,
                    sub: currentUser.sub
                };
                const agentId = await userRepository.add(userWithoutId);
                return {
                    user: {
                        id: agentId,
                        ...userWithoutId,
                        declarations: [],
                        sub: null
                    }
                };
            }

            throw new TRPCError({
                "code": "NOT_FOUND",
                message: "Agent not found"
            });
        }

        if (!user)
            throw new TRPCError({
                "code": "NOT_FOUND",
                message: "Agent not found"
            });

        if (!user?.isPublic) throw new TRPCError({ "code": "UNAUTHORIZED" });

        return { user };
    };

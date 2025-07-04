// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { TRPCError } from "@trpc/server";
import { WithUserSubAndEmail } from "../../rpc/user";
import { UserRepository, UserWithId } from "../ports/DbApiV2";

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
                const agentWithoutId = {
                    email: currentUser.email,
                    organization: null,
                    about: "",
                    isPublic: false
                };
                const agentId = await userRepository.add(agentWithoutId);
                return {
                    user: {
                        id: agentId,
                        ...agentWithoutId,
                        declarations: []
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

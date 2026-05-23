// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type {
    SoftwareFormData,
    SoftwareProtection,
    SoftwareProtectionData,
    SoftwareProtections
} from "./readWriteSillData";
import { ProtectionReasonRequiredError } from "./softwareErrors";

type CurrentUser = { id: number; role: "admin" | "user" };

const protectionKinds = ["dereferencing", "edition"] as const;

const reasonRequiredMessages: Record<(typeof protectionKinds)[number], string> = {
    dereferencing: "Protected software requires a dereferencing protection reason",
    edition: "Protected software requires an edition protection reason"
};

export const resolveSoftwareFormDataProtections = ({
    formDataProtections,
    existingProtections,
    currentUser,
    now
}: {
    formDataProtections: SoftwareFormData["protections"];
    existingProtections: SoftwareProtections | undefined;
    currentUser: CurrentUser;
    now: string;
}): SoftwareProtections | undefined => {
    const resolved: SoftwareProtections = {};
    for (const kind of protectionKinds) {
        resolved[kind] = resolveSoftwareFormDataProtection({
            formDataProtection: formDataProtections?.[kind],
            existingProtection: existingProtections?.[kind],
            currentUser,
            now,
            reasonRequiredMessage: reasonRequiredMessages[kind]
        });
    }
    if (protectionKinds.every(kind => resolved[kind] === undefined)) return undefined;
    return resolved;
};

const resolveSoftwareFormDataProtection = ({
    formDataProtection,
    existingProtection,
    currentUser,
    now,
    reasonRequiredMessage
}: {
    formDataProtection: SoftwareProtectionData | undefined;
    existingProtection: SoftwareProtection | undefined;
    currentUser: CurrentUser;
    now: string;
    reasonRequiredMessage: string;
}): SoftwareProtection | undefined => {
    if (currentUser.role !== "admin") return existingProtection;
    if (formDataProtection === undefined) return existingProtection;

    const reason = formDataProtection.reason?.trim() || null;

    if (formDataProtection.isProtected && reason === null) {
        throw new ProtectionReasonRequiredError(reasonRequiredMessage);
    }

    // No prior protection and admin chose not to protect → no audit row to write.
    if (!formDataProtection.isProtected && existingProtection === undefined) {
        return undefined;
    }

    if (
        existingProtection !== undefined &&
        existingProtection.isProtected === formDataProtection.isProtected &&
        existingProtection.reason === reason
    ) {
        return existingProtection;
    }

    return {
        isProtected: formDataProtection.isProtected,
        reason,
        updatedAt: now,
        updatedByUserId: currentUser.id
    };
};

// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { CustomAttributes } from "../usecases/readWriteSillData/attributeTypes";
import type { Os, RuntimePlatform } from "../types";

export type Db = {
    softwareRows: Db.SoftwareRow[];
    agentRows: Db.AgentRow[];
    softwareReferentRows: Db.SoftwareReferentRow[];
    softwareUserRows: Db.SoftwareUserRow[];
    instanceRows: Db.InstanceRow[];
};

export namespace Db {
    export type SoftwareRow = {
        id: number;
        name: string;
        description: string;
        referencedSinceTime: number;
        updateTime: number;
        dereferencing?: {
            reason?: string;
            time: number;
            lastRecommendedVersion?: string;
        };
        isStillInObservation: boolean;
        similarSoftwareExternalDataIds: string[];
        externalId?: string;
        sourceSlug?: string;
        externalDataOrigin?: "wikidata" | "HAL";
        /* cspell: disable-next-line */
        //// https://spdx.org/licenses/:
        //// https://www.data.gouv.fr/fr/pages/legal/licences/
        license: string;
        operatingSystems: Partial<Record<Os, boolean>>;
        runtimePlatforms: RuntimePlatform[];
        categories: string[];
        addedByAgentEmail: string;
        logoUrl: string | undefined;
        keywords: string[];
        customAttributes: CustomAttributes | null;
    };

    export type AgentRow = {
        email: string;
        organization: string;
        about: string | undefined;
        isPublic: boolean;
    };

    export type SoftwareReferentRow = {
        softwareId: number;
        agentEmail: string;
        isExpert: boolean;
        useCaseDescription: string;
        /** NOTE: Can be not undefined only if cloud */
        serviceUrl: string | undefined;
    };

    export type SoftwareUserRow = {
        softwareId: number;
        agentEmail: string;
        useCaseDescription: string;
        os: Os | undefined;
        version: string;
        /** NOTE: Can be not undefined only if cloud */
        serviceUrl: string | undefined;
    };

    export type InstanceRow = {
        id: number;
        mainSoftwareSillId: number;
        organization: string;
        targetAudience: string;
        publicUrl: string | undefined;
        addedByAgentEmail: string;
        referencedSinceTime: number;
        updateTime: number;
    };
}

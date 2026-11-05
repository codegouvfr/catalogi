// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { applySourceConfigurationPatch, toSourceConfigurationView } from "./sourceConfiguration";

describe("toSourceConfigurationView", () => {
    it("never exposes the credential nor the values of unmanaged keys", () => {
        const view = toSourceConfigurationView({
            kind: "GitLab",
            configuration: { auth: "secret", queryTimeout: 5000, rateLimitRetryDuration: 100, extra: "x" } as never
        });

        expect(view).toEqual({
            isCredentialSet: true,
            settings: { queryTimeout: 5000 },
            otherKeys: ["extra", "rateLimitRetryDuration"]
        });
        expect(JSON.stringify(view)).not.toContain("secret");
    });

    it("lists the credential key as unmanaged for kinds without credential", () => {
        expect(toSourceConfigurationView({ kind: "CNLL", configuration: { auth: "secret" } })).toEqual({
            isCredentialSet: false,
            settings: {},
            otherKeys: ["auth"]
        });
    });
});

describe("applySourceConfigurationPatch", () => {
    it("keeps the credential and unknown keys when they are not part of the patch", () => {
        expect(
            applySourceConfigurationPatch({
                kind: "wikidata",
                configuration: { auth: "secret", queryTimeout: 5000, extra: "x" } as never,
                patch: { settings: { queryTimeout: 8000, rateLimitRetryDuration: null } }
            })
        ).toEqual({ auth: "secret", queryTimeout: 8000, extra: "x" });
    });

    it("replaces and clears the credential", () => {
        const replaced = applySourceConfigurationPatch({
            kind: "GitHub",
            configuration: { auth: "old" },
            patch: { credential: { action: "replace", value: " new " } }
        });
        expect(replaced).toEqual({ auth: "new" });

        expect(
            applySourceConfigurationPatch({
                kind: "GitHub",
                configuration: replaced,
                patch: { credential: { action: "clear" } }
            })
        ).toEqual({});
    });

    it("rejects the fields the kind does not read", () => {
        expect(() =>
            applySourceConfigurationPatch({
                kind: "GitHub",
                configuration: undefined,
                patch: { settings: { rateLimitRetryDuration: 1000 } }
            })
        ).toThrow(/not a setting of GitHub/);
        expect(() =>
            applySourceConfigurationPatch({
                kind: "RNSR",
                configuration: undefined,
                patch: { credential: { action: "replace", value: "x" } }
            })
        ).toThrow(/take no credential/);
    });

    it("rejects non positive durations", () => {
        expect(() =>
            applySourceConfigurationPatch({
                kind: "HAL",
                configuration: undefined,
                patch: { settings: { queryTimeout: 0 } }
            })
        ).toThrow(/positive/);
    });
});

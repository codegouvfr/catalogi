// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSourceCredential, encryptSourceCredential, parseSourceCredentialsKey } from "./sourceCredentialCipher";

const generateKey = () => parseSourceCredentialsKey(randomBytes(32).toString("base64"));
const key = generateKey();

describe("source credential cipher", () => {
    it("decrypts what it encrypted, without the clear value in the stored one", () => {
        const stored = encryptSourceCredential(key, "ghp_secret");

        expect(stored.startsWith("enc:v1:")).toBe(true);
        expect(stored).not.toContain("ghp_secret");
        expect(encryptSourceCredential(key, "ghp_secret")).not.toBe(stored);
        expect(decryptSourceCredential(key, stored)).toBe("ghp_secret");
    });

    it("returns a legacy clear value as is, with or without a key", () => {
        expect(decryptSourceCredential(key, "ghp_legacy")).toBe("ghp_legacy");
        expect(decryptSourceCredential(undefined, "ghp_legacy")).toBe("ghp_legacy");
    });

    it("refuses to decrypt with another key", () => {
        const stored = encryptSourceCredential(key, "ghp_secret");

        expect(() => decryptSourceCredential(generateKey(), stored)).toThrow("cannot be decrypted");
    });

    it("refuses an altered value", () => {
        const stored = encryptSourceCredential(key, "ghp_secret");
        const payload = Buffer.from(stored.slice("enc:v1:".length), "base64");
        payload[payload.length - 1] ^= 1;

        expect(() => decryptSourceCredential(key, `enc:v1:${payload.toString("base64")}`)).toThrow(
            "cannot be decrypted"
        );
        expect(() => decryptSourceCredential(key, "enc:v1:")).toThrow("cannot be decrypted");
    });

    it("refuses an encrypted value when no key is set, or an unknown format", () => {
        const stored = encryptSourceCredential(key, "ghp_secret");

        expect(() => decryptSourceCredential(undefined, stored)).toThrow("SOURCE_CREDENTIALS_KEY is not set");
        expect(() => decryptSourceCredential(key, "enc:v2:abc")).toThrow("unknown format");
    });

    it("only accepts a 32-byte base64 key", () => {
        const base64Key = key.toString("base64");

        expect(parseSourceCredentialsKey(base64Key).equals(key)).toBe(true);
        expect(() => parseSourceCredentialsKey("")).toThrow("SOURCE_CREDENTIALS_KEY");
        expect(() => parseSourceCredentialsKey(randomBytes(16).toString("base64"))).toThrow("SOURCE_CREDENTIALS_KEY");
        expect(() => parseSourceCredentialsKey(`${base64Key}!`)).toThrow("SOURCE_CREDENTIALS_KEY");
    });
});

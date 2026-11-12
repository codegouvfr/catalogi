// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const encryptedPrefix = "enc:";
const v1Prefix = `${encryptedPrefix}v1:`;
const ivLength = 12;
const authTagLength = 16;

export type SourceCredentialsKey = Buffer & { readonly __brand: "SourceCredentialsKey" };

export const parseSourceCredentialsKey = (base64Key: string): SourceCredentialsKey => {
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== 32 || key.toString("base64") !== base64Key)
        throw new Error("SOURCE_CREDENTIALS_KEY must be 32 bytes encoded in base64 (openssl rand -base64 32)");
    return key as SourceCredentialsKey;
};

export const isEncryptedSourceCredential = (stored: string) => stored.startsWith(encryptedPrefix);

export const encryptSourceCredential = (key: SourceCredentialsKey, credential: string): string => {
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(algorithm, key, iv, { authTagLength });
    const encrypted = Buffer.concat([cipher.update(credential, "utf8"), cipher.final()]);
    return v1Prefix + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
};

// Values stored before encryption was enabled are returned as is.
export const decryptSourceCredential = (key: SourceCredentialsKey | undefined, stored: string): string => {
    if (!isEncryptedSourceCredential(stored)) return stored;
    if (!stored.startsWith(v1Prefix)) throw new Error("A source credential is stored in an unknown format");
    if (key === undefined) throw new Error("A source credential is encrypted but SOURCE_CREDENTIALS_KEY is not set");

    const payload = Buffer.from(stored.slice(v1Prefix.length), "base64");
    try {
        const decipher = createDecipheriv(algorithm, key, payload.subarray(0, ivLength), { authTagLength });
        decipher.setAuthTag(payload.subarray(ivLength, ivLength + authTagLength));
        return Buffer.concat([decipher.update(payload.subarray(ivLength + authTagLength)), decipher.final()]).toString(
            "utf8"
        );
    } catch {
        throw new Error("A source credential cannot be decrypted: wrong SOURCE_CREDENTIALS_KEY or altered value");
    }
};

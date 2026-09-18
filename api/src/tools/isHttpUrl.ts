// SPDX-FileCopyrightText: 2026 DINUM <floss@numerique.gouv.fr>
// SPDX-License-Identifier: MIT

/** Shared by RPC validation and rendering, including for legacy stored values. */
export function isHttpUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    try {
        // No base: relative and protocol-relative URLs must not be accepted.
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

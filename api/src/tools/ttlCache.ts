// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

// In-memory cache whose entries expire after `ttlMs`. Beyond `maxEntries`, the oldest
// entry is dropped.
export const makeTtlCache = <Value>(params: { ttlMs: number; maxEntries: number; now?: () => number }) => {
    const { ttlMs, maxEntries, now = Date.now } = params;
    // Map keeps the insertion order: the first entry is the oldest.
    const entries = new Map<string, { value: Value; expiresAt: number }>();

    return {
        get: (key: string): Value | undefined => {
            const entry = entries.get(key);
            if (!entry) return undefined;
            if (entry.expiresAt > now()) return entry.value;
            entries.delete(key);
            return undefined;
        },
        set: (key: string, value: Value) => {
            entries.delete(key);
            if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
            entries.set(key, { value, expiresAt: now() + ttlMs });
        }
    };
};

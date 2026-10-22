// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

// In-memory cache whose entries expire after `ttlMs`. Expired entries are dropped on write.
export const makeTtlCache = <Value>(params: { ttlMs: number; now?: () => number }) => {
    const { ttlMs, now = Date.now } = params;
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
            const time = now();
            for (const [entryKey, entry] of entries) if (entry.expiresAt <= time) entries.delete(entryKey);
            entries.set(key, { value, expiresAt: time + ttlMs });
        }
    };
};

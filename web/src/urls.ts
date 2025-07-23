// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

/**
 * Examples:
 * '/sill'
 * ''
 **/
export const appPath = (() => {
    const envValue = import.meta.env.BASE_URL;

    if (envValue === ".") {
        // Storybook
        return "";
    }

    // Remove trailing slash if present
    return envValue.endsWith("/") ? envValue.slice(0, -1) : envValue;
})();

console.log({ appPath });

/**
 * Without trailing slash.
 *
 *  Examples:
 * 'https://code.gouv.fr/sill'
 * 'https://code.gouv.fr'
 * 'http://localhost:3000'
 * 'http://localhost:3000/sill'
 **/
export const appUrl = `${window.location.origin}${appPath}`;

/**
 * Without trailing slash.
 *
 * Example 'https://code.gouv.fr/sill/api'
 **/
export const apiUrl = `${appUrl}/api`;

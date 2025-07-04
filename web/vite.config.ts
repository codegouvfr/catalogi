// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import svgr from "vite-plugin-svgr";
import { viteEnvs } from "vite-envs";

// https://vitejs.dev/config/
export default defineConfig(async () => {
    // Dynamically import vite-tsconfig-paths
    const tsconfigPaths = (await import("vite-tsconfig-paths")).default;

    return {
        plugins: [
            react(),
            tsconfigPaths(),
            svgr({
                svgrOptions: {
                    exportType: "default",
                    ref: true,
                    svgo: false,
                    titleProp: true
                }
            }),
            viteEnvs({
                declarationFile: ".env.declaration"
            })
        ],
        define: {
            "import.meta.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
            // Define any other environment variables needed
            "import.meta.env.PUBLIC_URL": JSON.stringify("")
        },
        resolve: {
            alias: {
                src: path.resolve(__dirname, "src")
            }
        },
        server: {
            port: 3000
        },
        build: {
            outDir: "build", // Same output directory as CRA
            sourcemap: true,
            commonjsOptions: {
                transformMixedEsModules: true
            }
        },
        assetsInclude: ["**/*.md"], // Treat markdown files as assets
        base: "/" // Set the base path for the application
    };
});

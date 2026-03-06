import { defineConfig, devices } from "@playwright/test";

const API_PORT = 4084;
const WEB_PORT = 4000;

export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",
    use: {
        baseURL: `http://localhost:${WEB_PORT}`,
        trace: "on-first-retry",
        launchOptions: {
            slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0
        }
    },
    webServer: [
        {
            command: "node dist/src/entrypoints/start-api.js",
            cwd: "../api",
            url: `http://localhost:${API_PORT}/public/healthcheck`,
            timeout: 20_000,
            reuseExistingServer: !process.env.CI,
            env: {
                ...process.env,
                APP_URL: `http://localhost:${WEB_PORT}`,
                API_PORT: String(API_PORT),
                IS_DEV_ENVIRONNEMENT: "true"
            }
        },
        {
            command: `npx vite --port ${WEB_PORT} --strict-port`,
            cwd: "../web",
            url: `http://localhost:${WEB_PORT}`,
            timeout: 20_000,
            reuseExistingServer: !process.env.CI,
            env: {
                ...process.env,
                API_PORT: String(API_PORT)
            }
        }
    ],
    projects: [
        {
            name: "setup",
            testMatch: /auth\.setup\.ts/
        },
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
            testIgnore: /auth\./
        },
        {
            name: "chromium-auth",
            use: {
                ...devices["Desktop Chrome"],
                storageState: ".auth/user.json"
            },
            dependencies: ["setup"],
            testMatch: /\.auth\.spec\.ts/
        }
    ]
});

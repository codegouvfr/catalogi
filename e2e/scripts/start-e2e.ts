import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, Wait } from "testcontainers";
import { execSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, "../..");
const API_DIR = resolve(ROOT_DIR, "api");
const E2E_DIR = resolve(SCRIPT_DIR, "..");

const KEYCLOAK_CLIENT_SECRET = "test-client-secret";
const WEB_PORT = 4000;
const API_PORT = 4084;
const E2E_PORTS = [WEB_PORT, API_PORT];

const killPortProcesses = (ports: number[]) => {
    for (const port of ports) {
        try {
            execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: "ignore" });
        } catch {
            // No process on this port
        }
    }
};

const execCommand = (
    command: string,
    args: string[],
    options: { cwd: string; env?: Record<string, string> }
): Promise<void> =>
    new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            stdio: "inherit"
        });
        proc.on("close", code => {
            if (code === 0) resolve();
            else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
        });
        proc.on("error", reject);
    });

const buildTestRealm = (): string => {
    const realmPath = resolve(ROOT_DIR, "deployment-examples/keycloak-docker-compose/catalogi-realm.json");
    const realm = JSON.parse(readFileSync(realmPath, "utf-8"));

    realm.sslRequired = "none";

    const catalogiClient = realm.clients.find((c: { clientId: string }) => c.clientId === "catalogi");
    if (!catalogiClient) throw new Error("catalogi client not found in realm JSON");
    catalogiClient.publicClient = false;
    catalogiClient.secret = KEYCLOAK_CLIENT_SECRET;
    catalogiClient.redirectUris = [...catalogiClient.redirectUris, `http://localhost:${WEB_PORT}/*`];
    catalogiClient.webOrigins = [...catalogiClient.webOrigins, `http://localhost:${WEB_PORT}`];

    const emailScope = realm.clientScopes.find((s: { name: string }) => s.name === "email");
    if (emailScope) {
        emailScope.protocolMappers = [
            {
                name: "email",
                protocol: "openid-connect",
                protocolMapper: "oidc-usermodel-attribute-mapper",
                consentRequired: false,
                config: {
                    "userinfo.token.claim": "true",
                    "user.attribute": "email",
                    "id.token.claim": "true",
                    "access.token.claim": "true",
                    "claim.name": "email",
                    "jsonType.label": "String"
                }
            },
            {
                name: "email verified",
                protocol: "openid-connect",
                protocolMapper: "oidc-usermodel-property-mapper",
                consentRequired: false,
                config: {
                    "userinfo.token.claim": "true",
                    "user.attribute": "emailVerified",
                    "id.token.claim": "true",
                    "access.token.claim": "true",
                    "claim.name": "email_verified",
                    "jsonType.label": "boolean"
                }
            }
        ];
    }

    const profileScope = realm.clientScopes.find((s: { name: string }) => s.name === "profile");
    if (profileScope) {
        profileScope.protocolMappers = [
            {
                name: "given name",
                protocol: "openid-connect",
                protocolMapper: "oidc-usermodel-attribute-mapper",
                consentRequired: false,
                config: {
                    "userinfo.token.claim": "true",
                    "user.attribute": "firstName",
                    "id.token.claim": "true",
                    "access.token.claim": "true",
                    "claim.name": "given_name",
                    "jsonType.label": "String"
                }
            },
            {
                name: "family name",
                protocol: "openid-connect",
                protocolMapper: "oidc-usermodel-attribute-mapper",
                consentRequired: false,
                config: {
                    "userinfo.token.claim": "true",
                    "user.attribute": "lastName",
                    "id.token.claim": "true",
                    "access.token.claim": "true",
                    "claim.name": "family_name",
                    "jsonType.label": "String"
                }
            },
            {
                name: "username",
                protocol: "openid-connect",
                protocolMapper: "oidc-usermodel-attribute-mapper",
                consentRequired: false,
                config: {
                    "userinfo.token.claim": "true",
                    "user.attribute": "username",
                    "id.token.claim": "true",
                    "access.token.claim": "true",
                    "claim.name": "preferred_username",
                    "jsonType.label": "String"
                }
            }
        ];
    }

    realm.users = [
        {
            username: "test@example.com",
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            emailVerified: true,
            enabled: true,
            credentials: [{ type: "password", value: "test123", temporary: false }],
            realmRoles: ["default-roles-catalogi"]
        }
    ];

    return JSON.stringify(realm, null, 2);
};

const main = async () => {
    console.log("Killing leftover processes on e2e ports...");
    killPortProcesses(E2E_PORTS);

    console.log("Starting containers and building API in parallel...");

    const apiBuildPromise = execCommand("yarn", ["build"], { cwd: API_DIR });

    const pgPromise = new PostgreSqlContainer("postgres:16-alpine").start();

    const kcPromise = new GenericContainer("quay.io/keycloak/keycloak:26.2.5")
        .withExposedPorts(8080)
        .withEnvironment({ KEYCLOAK_ADMIN: "admin", KEYCLOAK_ADMIN_PASSWORD: "admin" })
        .withCopyContentToContainer([
            { content: buildTestRealm(), target: "/opt/keycloak/data/import/catalogi-realm.json" }
        ])
        .withCommand(["start-dev", "--import-realm"])
        .withStartupTimeout(120_000)
        .withWaitStrategy(Wait.forLogMessage("Listening on"))
        .start();

    const [, pgContainer, keycloakContainer] = await Promise.all([apiBuildPromise, pgPromise, kcPromise]);

    const databaseUrl = pgContainer.getConnectionUri();
    const keycloakBaseUrl = `http://${keycloakContainer.getHost()}:${keycloakContainer.getMappedPort(8080)}`;
    console.log(`PostgreSQL ready: ${databaseUrl}`);
    console.log(`Keycloak ready: ${keycloakBaseUrl}`);

    const apiEnv: Record<string, string> = {
        DATABASE_URL: databaseUrl,
        OIDC_ISSUER_URI: `${keycloakBaseUrl}/realms/catalogi`,
        OIDC_CLIENT_ID: "catalogi",
        OIDC_CLIENT_SECRET: KEYCLOAK_CLIENT_SECRET,
        OIDC_MANAGE_PROFILE_URL: `${keycloakBaseUrl}/realms/catalogi/account`
    };

    let cleanedUp = false;
    const cleanup = async () => {
        if (cleanedUp) return;
        cleanedUp = true;
        killPortProcesses(E2E_PORTS);
        await pgContainer.stop();
        await keycloakContainer.stop();
        console.log("Cleanup complete");
    };

    try {
        console.log("Running migrations...");
        await execCommand("yarn", ["migrate", "latest"], { cwd: API_DIR, env: apiEnv });

        console.log("Seeding database...");
        await execCommand("node", ["dist/scripts/seed.js"], { cwd: API_DIR, env: apiEnv });

        if (!process.env.CI) {
            console.log("Installing Playwright browsers (if needed)...");
            await execCommand("npx", ["playwright", "install", "chromium"], { cwd: E2E_DIR });
        }

        mkdirSync(resolve(E2E_DIR, ".auth"), { recursive: true });

        console.log("Starting Playwright...");
        const playwrightArgs = process.argv.slice(2);
        const playwright = spawn("npx", ["playwright", "test", ...playwrightArgs], {
            cwd: E2E_DIR,
            env: {
                ...process.env,
                ...apiEnv,
                KEYCLOAK_BASE_URL: keycloakBaseUrl
            },
            stdio: "inherit"
        });

        playwright.on("close", async code => {
            await cleanup();
            process.exit(code ?? 0);
        });

        const handleSignal = async () => {
            playwright.kill();
            await cleanup();
            process.exit(1);
        };

        process.on("SIGINT", handleSignal);
        process.on("SIGTERM", handleSignal);
    } catch (err) {
        await cleanup();
        throw err;
    }
};

main().catch(err => {
    console.error("E2E setup failed:", err);
    process.exit(1);
});

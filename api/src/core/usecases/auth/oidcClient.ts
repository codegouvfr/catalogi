// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export type OidcParams = {
    issuerUri: string;
    clientId: string;
    clientSecret: string;
    appUrl: string;
};

type OidcConfiguration = {
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    end_session_endpoint?: string;
};

type OidcUserInfo = {
    sub: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
};

export interface OidcClient {
    clientId: string;
    redirectUri: string;
    getAuthorizationEndpoint(): string;
    exchangeCodeForTokens(code: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type: string;
        id_token?: string;
    }>;
    getUserInfo(accessToken: string): Promise<OidcUserInfo>;
    logout(idToken: string | null): Promise<string>;
}

export class HttpOidcClient implements OidcClient {
    #config!: OidcConfiguration;
    #oidcParams: OidcParams;

    private constructor(oidcParams: OidcParams) {
        this.#oidcParams = oidcParams;
    }

    static async create(oidcParams: OidcParams): Promise<HttpOidcClient> {
        const client = new HttpOidcClient(oidcParams);
        await client.#fetchConfiguration();
        return client;
    }

    async #fetchConfiguration(): Promise<void> {
        const configUrl = `${this.#oidcParams.issuerUri}/.well-known/openid-configuration`;
        const response = await fetch(configUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
        }

        this.#config = await response.json();
    }

    getAuthorizationEndpoint(): string {
        return this.#config.authorization_endpoint;
    }

    get clientId(): string {
        return this.#oidcParams.clientId;
    }

    get redirectUri(): string {
        return `${this.#oidcParams.appUrl}/api/auth/callback`;
    }

    get logoutRedirectUri(): string {
        return `${this.#oidcParams.appUrl}/api/auth/logout/callback`;
    }

    async exchangeCodeForTokens(code: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type: string;
        id_token?: string;
    }> {
        const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: this.redirectUri,
            client_id: this.#oidcParams.clientId,
            client_secret: this.#oidcParams.clientSecret
        });

        const response = await fetch(this.#config.token_endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        });

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.statusText}`);
        }

        return response.json();
    }

    async getUserInfo(accessToken: string): Promise<OidcUserInfo> {
        const response = await fetch(this.#config.userinfo_endpoint, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.statusText}`);
        }

        const responseBody = await response.text();

        const userInfoAsString = responseBody.startsWith("ey") ? atob(responseBody.split(".")[1]) : responseBody;

        console.log("\n \n userInfoAsString : ", userInfoAsString);

        return JSON.parse(userInfoAsString);
    }

    async logout(idToken: string | null): Promise<string> {
        if (!this.#config.end_session_endpoint) {
            return this.logoutRedirectUri; // in that case we skip the logout and redirect to the identity provider logout page
        }

        const logoutUrl = new URL(this.#config.end_session_endpoint);
        logoutUrl.search = new URLSearchParams({
            post_logout_redirect_uri: this.logoutRedirectUri,
            ...(idToken ? { id_token_hint: idToken } : {})
        }).toString();

        return logoutUrl.toString();
    }
}

export type TestOidcClientCall = {
    method: "getAuthorizationEndpoint" | "exchangeCodeForTokens" | "getUserInfo" | "logout";
    args: any[];
};

export class TestOidcClient implements OidcClient {
    #config: OidcConfiguration;
    #oidcParams: OidcParams;
    #calls: TestOidcClientCall[] = [];

    constructor(oidcParams: OidcParams) {
        this.#oidcParams = oidcParams;
        this.#config = {
            authorization_endpoint: `${oidcParams.issuerUri}/auth`,
            token_endpoint: `${oidcParams.issuerUri}/token`,
            userinfo_endpoint: `${oidcParams.issuerUri}/userinfo`,
            end_session_endpoint: `${oidcParams.issuerUri}/logout`
        };
    }

    get calls(): TestOidcClientCall[] {
        return this.#calls;
    }

    getAuthorizationEndpoint(): string {
        this.#calls.push({
            method: "getAuthorizationEndpoint",
            args: []
        });
        return this.#config.authorization_endpoint;
    }

    get clientId(): string {
        return this.#oidcParams.clientId;
    }

    get redirectUri(): string {
        return `${this.#oidcParams.appUrl}/api/auth/callback`;
    }

    get logoutRedirectUri(): string {
        return `${this.#oidcParams.appUrl}/api/auth/logout/callback`;
    }

    async exchangeCodeForTokens(code: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type: string;
        id_token?: string;
    }> {
        this.#calls.push({
            method: "exchangeCodeForTokens",
            args: [code]
        });
        return {
            access_token: `test-token-${code}`,
            refresh_token: `test-refresh-${code}`,
            expires_in: 3600,
            token_type: "Bearer",
            id_token: `test-id-token-${code}`
        };
    }

    async getUserInfo(accessToken: string): Promise<OidcUserInfo> {
        this.#calls.push({
            method: "getUserInfo",
            args: [accessToken]
        });
        return {
            sub: "test-user-123",
            email: "test@example.com",
            name: "Test User",
            given_name: "User first name",
            family_name: "User last name"
        };
    }

    async logout(idToken: string | null): Promise<string> {
        this.#calls.push({
            method: "logout",
            args: [idToken]
        });

        if (!this.#config.end_session_endpoint) {
            throw new Error("OIDC provider does not support logout");
        }

        const logoutUrl = new URL(this.#config.end_session_endpoint);

        logoutUrl.search = new URLSearchParams({
            post_logout_redirect_uri: this.logoutRedirectUri,
            ...(idToken ? { id_token_hint: idToken } : {})
        }).toString();

        return logoutUrl.toString();
    }
}

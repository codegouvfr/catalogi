<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Environment Variables and Customization

## Environment variables

The following environment variables are used to configure the Catalogi web application.
You can set them in a `.env` file or directly in your environment.

The API validates its variables at startup and refuses to start if a required one is missing.

| Variable Name                | Used by       | Required | Default Value | Example Value                                                |
| ---------------------------- | ------------- | -------- | ------------- | ------------------------------------------------------------ |
| OIDC_ISSUER_URI              | API           | ✅       | -             | `http://localhost:8080/realms/catalogi`                      |
| OIDC_CLIENT_ID               | API           | ✅       | -             | `catalogi`                                                   |
| OIDC_CLIENT_SECRET           | API           | ✅       | -             | `secret-value-here`                                          |
| OIDC_MANAGE_PROFILE_URL      | API           | ✅       | -             | `http://localhost:8080/realms/catalogi/account`              |
| APP_URL                      | API           | ✅       | -             | `http://localhost:3000`                                      |
| CATALOGI_INITIAL_ADMIN_EMAIL | API           | ❌       | -             | `admin@example.com`                                          |
| DATABASE_URL                 | API, jobs     | ✅       | -             | `postgresql://catalogi:pg_password@localhost:5432/catalogi`  |
| API_PORT                     | API           | ❌       | `8080`        | `1234`                                                       |
| IS_DEV_ENVIRONNEMENT         | API, jobs     | ❌       | `false`       | `true`                                                       |
| ENVIRONMENT                  | API, web      | ❌       | `local`       | `local`, `dev`, `staging`, `pre-production`, or `production` |
| SENTRY_DSN_API               | API           | ❌       | -             | `https://key@sentry.example.com/1`                           |
| SENTRY_DSN_WEB               | web           | ❌       | -             | `https://key@sentry.example.com/2`                           |
| REDIRECT_URL                 | API           | ❌       | -             | `https://catalogi.example.com`                               |
| GITHUB_TOKEN                 | API           | ❌       | -             | `ghp_xxx`                                                    |
| IMPORT_DATA_SOURCE_ORIGIN    | import job    | ❌       | `wikidata`    | `wikidata`                                                   |
| IMPORT_DATA_IDS              | import job    | ❌       | -             | `Q123,Q456,Q789`                                             |
| BOT_USER_EMAIL               | import job    | ❌       | -             | `bot@example.com`                                            |
| UPDATE_SKIP_TIMING           | update job    | ❌       | `180`         | `240`                                                        |
| UPDATE_SOFTWARE_IDS          | update job    | ❌       | -             | `12,34`                                                      |
| VITE_HEAD                    | web           | ❌       | see below     | see below                                                    |
| VITE_CSP                     | web           | ❌       | see below     | see below                                                    |

- `OIDC_*`, `APP_URL` and `CATALOGI_INITIAL_ADMIN_EMAIL` are described in [Authentication](3.1-authentication.md).
- `REDIRECT_URL` completely disables the instance and redirects it to another URL.
- `GITHUB_TOKEN` is only used to increase the GitHub API rate limit, used to pre-fill versions when adding a software.
- `IMPORT_DATA_SOURCE_ORIGIN` is the slug of the source used by the import job, `IMPORT_DATA_IDS` the comma-separated identifiers to import from it, and `BOT_USER_EMAIL` the user the imported software is attributed to.
- `UPDATE_SKIP_TIMING` (in minutes) makes the update job skip external data refreshed more recently than that, and `UPDATE_SOFTWARE_IDS` restricts the update job to these software ids.

### ENVIRONMENT

The `ENVIRONMENT` variable identifies the deployment environment and is available in both the API (backend) and web (frontend). Valid values are:

- `local` - Local development environment (default)
- `dev` - Development environment
- `staging` - Staging environment
- `pre-production` - Pre-production environment
- `production` - Production environment

This variable can be used to enable environment-specific features and configurations, such as:

- Error monitoring and logging services (e.g., Sentry)
- Analytics and tracking tools
- Feature flags and conditional behavior
- Different API endpoints or service configurations

Sentry error tracking is enabled only when `SENTRY_DSN_API` (API) or `SENTRY_DSN_WEB` (web) is set; `ENVIRONMENT` is then reported as the Sentry environment.

### VITE_HEAD

There is another variable that is purely for frontend configuration, which can contain HTML code, that will be injected in the `<head>` of the web application. It is useful to add meta tags, or other HTML elements that you want to be present in the head of the page. Note that you cannot use the syntax with backticks '`'.

```
VITE_HEAD="
  <title>Catalogi - Deployment exemple</title>

  <script defer>
    console.log('This is a custom code in head');
  </script>
"
```

#### Analytics and SPA route tracking

The web app is a single-page application: after the first HTML response, all subsequent navigations happen client-side and never trigger a fresh page load. To make these navigations visible to analytics providers, the app dispatches a `routechange` `CustomEvent` on `window` every time the route changes. The app itself stays provider-agnostic — it knows nothing about Matomo, Plausible, PostHog, or any other tool. Wiring an analytics provider is therefore entirely a `VITE_HEAD` concern.

The event payload (`event.detail`) carries:

- `url` — the new fully-qualified URL (`window.location.href` after the navigation)
- `referrer` — the URL the user came from (the previous `window.location.href`), or `null` for the initial pageview

The `routechange` event fires for **every** pageview, including the initial one. The app dispatches a synthetic `routechange` once at startup (with `referrer: null`) immediately after registering its route listener, so deployments only need to wire up a single listener — there is no separate code path for the entry pageview.

> **Breaking change vs. the previous pattern.** Earlier deployments wired the entry pageview by calling `_paq.push(['trackPageView'])` inline at the bottom of the Matomo bootstrap snippet, alongside an event listener for subsequent navigations. That inline call **must be removed** when upgrading, otherwise the initial pageview will be counted twice (once by the inline call, once by the synthetic `routechange`).

Example wiring for Matomo (to be placed inside `VITE_HEAD`, alongside the usual Matomo bootstrap snippet that defines `window._paq` and loads `matomo.js`):

```html
<script defer>
  window.addEventListener("routechange", function (e) {
    var d = e.detail;
    var _paq = window._paq;
    if (!_paq) return;
    _paq.push(["setReferrerUrl", d.referrer]);
    _paq.push(["setCustomUrl", d.url]);
    _paq.push(["setDocumentTitle", document.title]);
    _paq.push(["deleteCustomVariables", "page"]);
    _paq.push(["trackPageView"]);
    _paq.push(["enableLinkTracking"]);
  });
</script>
```

Note that the listener reads `document.title` directly rather than receiving it on `event.detail`. This is intentional: it keeps the event payload honest about what it carries, and remains correct if per-route titles are introduced later.

For other providers, replace the body of the listener with the equivalent call (`plausible('pageview', { u: d.url })`, `posthog.capture('$pageview', { $current_url: d.url })`, etc.). Deployments with no analytics need no listener at all — `dispatchEvent` is a no-op when nothing is subscribed.

### VITE_CSP

The Content-Security-Policy of the web application is delivered in two layers, with no overlap between them:

- **A hardcoded nginx response header** (`web/nginx.conf`) carries only the directives that the `<meta http-equiv>` form cannot set: `base-uri 'self'; form-action 'self';`. This is cheap defence-in-depth hardening for `<base href>` injection and cross-origin form submissions, neither of which the app does. It is **not** deployment-configurable — operators do not need to think about it. (`frame-ancestors` is intentionally not set yet — adding clickjacking protection requires an audit of who currently embeds the site, tracked separately.)
- **`VITE_CSP`** is the runtime-configurable layer. It carries everything else (`script-src`, `connect-src`, `object-src`, …) and is injected into the `content` attribute of a `<meta http-equiv="Content-Security-Policy">` tag in `index.html`.

Because the two layers carry **disjoint sets of directives**, they cannot block each other through CSP intersection: extending `VITE_CSP` to allowlist a third-party host can never be undone by the nginx baseline, and vice versa. Operators only ever need to edit `VITE_CSP`.

A safe baseline for `VITE_CSP` is shipped in `web/.env.declaration`:

```
VITE_CSP="script-src 'self' 'unsafe-eval' 'unsafe-inline'; worker-src 'self' blob:; img-src 'self' data: http: https:; object-src 'none';"
```

Two non-obvious directives in the baseline:

- **`img-src 'self' data: http: https:`** — the catalogue displays software logos sourced from arbitrary upstream origins (Wikimedia Commons, project homepages, GitHub avatars, …). Pinning `img-src` to a specific allowlist would break logos every time a new software entry points at a host you didn't anticipate. The baseline allows any image source over HTTP or HTTPS, plus `data:` URIs for inline icons. Some upstream sources (notably Wikidata-scraped thumbnail URLs) may serve images over plain HTTP or protocol-relative URLs, so both schemes are allowed.
- **`worker-src 'self' blob:`** — Sentry's Session Replay and Profiling features load their Web Worker from a `blob:` URL. Without this directive the worker is blocked and the relevant Sentry features silently fail; the rest of the app keeps working.

If your deployment needs to load resources from third-party origins (analytics, fonts, embedded media, error monitoring, …), override `VITE_CSP` and extend the relevant directives. For example, to allow Matomo hosted on `https://stats.data.gouv.fr` and Sentry on `https://sentry.example.org`:

```
VITE_CSP="script-src 'self' 'unsafe-eval' 'unsafe-inline' https://stats.data.gouv.fr; connect-src 'self' https://stats.data.gouv.fr https://sentry.example.org; img-src 'self' data: http: https:; worker-src 'self' blob:; object-src 'none';"
```

`script-src` carries the Matomo host so `matomo.js` can load. `connect-src` carries the Matomo host (for the tracking pixel POST) and the Sentry host (for envelope POSTs). `img-src` keeps the permissive baseline so software logos from arbitrary upstream origins keep working — including the Matomo no-JS fallback `<img>` tracker, which is just another HTTPS image.

A few things to know:

- **CSPs from multiple sources are intersected, not unioned.** You cannot loosen a CSP by adding a second, more permissive one — the browser keeps the strictest set of rules across all of them. The two layers shipped here (nginx header + `VITE_CSP` meta) are designed around this rule by carrying disjoint directive sets, so the intersection is effectively the union of their directives.
- **Quoting is intentionally simple.** CSP source-list keywords (`'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `'none'`, …) are required by the CSP spec to be single-quoted. The injection chain — env-file → `vite-envs` → `<meta content="...">` — keeps double quotes on the outside at every level, so the literal single quotes inside `VITE_CSP` flow through unchanged. No escaping, no HTML entities.
- **Why a dedicated env var rather than putting the meta in `VITE_HEAD`.** `vite-envs` substitutes placeholders via `awk gsub`, which interprets `&` in the replacement string as a backreference to the matched text. That means HTML entities like `&apos;` are silently corrupted if they appear inside `VITE_HEAD`. Splitting CSP out into its own variable sidesteps the entire quoting problem and keeps the placeholder content free of `&`.
- **Sentry / `connect-src` / `worker-src`.** When wiring up Sentry (see the `ENVIRONMENT` section above), `VITE_CSP` will need to allow your Sentry host in `script-src` and `connect-src`, and the baseline already includes `worker-src 'self' blob:` for Sentry's Session Replay and Profiling workers. The default policy does not set `default-src`, so `connect-src` falls back to `*` — which is fine until a `default-src` is introduced.

There are also some variables that are used only for the docker-compose.resources.yml to work properly in dev env. Make sure it is aligned with the `DATABASE_URL` variable above.

```
POSTGRES_DB=db
POSTGRES_USER=catalogi
POSTGRES_PASSWORD=pg_password
```

## UI Configuration

Administrators can edit the UI configuration from the **Administration → Interface configuration** tab. The editor validates both the JSON syntax and the schema before saving the configuration in PostgreSQL.

The `config_ui` database migration initializes this configuration exactly once. PostgreSQL is the only source of truth after the migration.

The configuration edited in the administration page has to follow the schema defined in `api/src/core/uiConfigSchema.ts`.

### New installation

Do not mount any `ui-config.json`. The migration inserts a standard configuration embedded in the migration, so the application works before the first administrator signs in. Then customize it from **Administration → Interface configuration**. The `customization` directory mount of the Docker Compose example is only used for custom translations. With Helm, leave `customization.uiConfig` empty, which is the default.

### Upgrading an existing file-based installation

Keep the customized `ui-config.json` of the existing installation mounted at `/app/api/dist/src/customization/ui-config.json` for the first startup of the new version. The migration reads, validates, and imports that file. Verify the imported configuration in **Administration → Interface configuration**, then remove the JSON file or mount. With Helm, provide the file content as `customization.uiConfig` (with `customization.enabled: true`), then set `customization.legacyUiConfigImportEnabled` to `false` or remove `customization.uiConfig`; custom translations remain mounted. With the Docker Compose example, delete `customization/ui-config.json` while keeping the directory mount if you use custom translations. Later file changes are intentionally ignored; make all further changes in the administration page.

The imported file has to follow the historical format frozen in the `config_ui` migration (`api/src/core/adapters/dbApi/kysely/migrations/1781768391060_add-config-ui-table.ts`), not the current `uiConfigSchema.ts`: keys added after this migration are rejected. Add newer settings from the administration page once the import is done. A mounted file that is unreadable, malformed, or incompatible stops the migration with an explicit error instead of silently using defaults.

## First administrator

Catalogi has no local passwords and never creates an `admin/admin` account. To initialize a new instance:

1. Configure the OIDC provider and callback URLs.
2. Set `CATALOGI_INITIAL_ADMIN_EMAIL` to the intended administrator's OIDC email address.
3. Start Catalogi and sign in with that address.
4. After confirming access to the administration page, optionally remove the variable.

The address is normalized to lowercase and is used only while no administrator exists. Without the variable, the public application starts but new users remain regular users and the API logs an initialization warning. All credentials and password policies are managed by the OIDC provider.

## Translations

The translations are also configurable, so you can choose any wording you want. It is defined in `api/src/customization/translations`. There you can add your own translations, providing a `en.json` and `fr.json` file. For now we support only English and French, but feel free to [raise an issue](https://github.com/codegouvfr/catalogi/issues/new) if you want to add more languages.

With the Docker images, mount these files at `/app/api/dist/src/customization/translations/en.json` and `fr.json`: the Docker Compose example mounts its `customization` directory, and the Helm chart uses `customization.translations`. The available keys are described by `api/src/rpc/translations/schema.json`.

Please note that you can override the translations you want, and all those that are not overridden will fallback to the default translations provided by the application.

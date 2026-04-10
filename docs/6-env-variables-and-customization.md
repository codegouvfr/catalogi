<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Environment Variables and Customization

## Environment variables

The following environment variables are used to configure the Catalogi web application.
You can set them in a `.env` file or directly in your environment.

| Variable Name | Required | Default Value | Example Value |
|----------------|----------|----------------|----------------|
| OIDC_ISSUER_URI | ✅ | - | `http://localhost:8080/realms/catalogi` |
| OIDC_CLIENT_ID | ✅ | - | `catalogi` |
| DATABASE_URL | ✅ | - | `postgresql://catalogi:pg_password@localhost:5432/catalogi` |
| API_PORT | ❌ | `8080` | `1234` |
| IS_DEV_ENVIRONNEMENT | ❌ | `false` | `true` |
| VITE_ENVIRONMENT | ❌ | `local` | `local`, `dev`, `staging`, `pre-production`, or `production` |
| EXTERNAL_SOFTWARE_DATA_ORIGIN | ❌ | `wikidata` | `wikidata` or `HAL` |
| INIT_SOFT_FROM_SOURCE | ❌ | `false` | `true` |
| BOT_AGENT_EMAIL | ❌ | - | `bot@example.com` |
| IMPORT_WIKIDATA | ❌ | - | `Q123,Q456,Q789` |
| REDIRECT_URL | ❌ | - | `https://catalogi.example.com` |

### VITE_ENVIRONMENT

The `VITE_ENVIRONMENT` variable identifies the deployment environment and is available in both the API (backend) and web (frontend). Valid values are:
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

While Sentry is not currently set up in this project, the `VITE_ENVIRONMENT` variable provides the foundation for integrating such tools if they become frequently requested features.

### VITE_HEAD

There is another variable that is purely for frontend configuration, which can contain HTML code, that will be injected in the `<head>` of the web application. It is useful to add meta tags, or other HTML elements that you want to be present in the head of the page. Note that you cannot use the syntay with backticks '`'.

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
  window.addEventListener('routechange', function (e) {
    var d = e.detail;
    var _paq = window._paq;
    if (!_paq) return;
    _paq.push(['setReferrerUrl', d.referrer]);
    _paq.push(['setCustomUrl', d.url]);
    _paq.push(['setDocumentTitle', document.title]);
    _paq.push(['deleteCustomVariables', 'page']);
    _paq.push(['trackPageView']);
    _paq.push(['enableLinkTracking']);
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
VITE_CSP="script-src 'self' 'unsafe-eval' 'unsafe-inline'; object-src 'none';"
```

If your deployment needs to load resources from third-party origins (analytics, fonts, embedded media, error monitoring, …), override `VITE_CSP` and extend the relevant directives. For example, to allow Matomo hosted on `https://stats.data.gouv.fr`:

```
VITE_CSP="script-src 'self' 'unsafe-eval' 'unsafe-inline' https://stats.data.gouv.fr; object-src 'none';"
```

A few things to know:

- **CSPs from multiple sources are intersected, not unioned.** You cannot loosen a CSP by adding a second, more permissive one — the browser keeps the strictest set of rules across all of them. The two layers shipped here (nginx header + `VITE_CSP` meta) are designed around this rule by carrying disjoint directive sets, so the intersection is effectively the union of their directives.
- **Quoting is intentionally simple.** CSP source-list keywords (`'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `'none'`, …) are required by the CSP spec to be single-quoted. The injection chain — env-file → `vite-envs` → `<meta content="...">` — keeps double quotes on the outside at every level, so the literal single quotes inside `VITE_CSP` flow through unchanged. No escaping, no HTML entities.
- **Why a dedicated env var rather than putting the meta in `VITE_HEAD`.** `vite-envs` substitutes placeholders via `awk gsub`, which interprets `&` in the replacement string as a backreference to the matched text. That means HTML entities like `&apos;` are silently corrupted if they appear inside `VITE_HEAD`. Splitting CSP out into its own variable sidesteps the entire quoting problem and keeps the placeholder content free of `&`.
- **Sentry / `connect-src`.** When wiring up Sentry (see the `VITE_ENVIRONMENT` section above), `VITE_CSP` will need to allow `*.sentry.io` in `script-src` and `connect-src`. The default policy does not set `default-src`, so `connect-src` falls back to `*` — which is fine until a `default-src` is introduced.

There are also some variables that are used only for the docker-compose.resources.yml to work properly in dev env. Make sure it is aligned with the `DATABASE_URL` variable above.

```
POSTGRES_DB=db
POSTGRES_USER=catalogi
POSTGRES_PASSWORD=pg_password
```

## UI Configuration

The UI can be customized, some tabs might not be relevant for your use case. We have a json file that can be used to configure the UI. It is located in `api/src/customization/ui-config.json`. It has to follow the schema defined in `api/src/core/uiConfigSchema.ts`.


## Translations

The translations are also configurable, so you can choose any wording you want. Is is defined in `api/src/customization/translations`. There you can add your own translations, providing a `en.json` and `fr.json` file. For now we support only English and French, but fill free to [raise an issue](https://github.com/codegouvfr/catalogi/issues/new) if you want to add more languages.

Please note that you can override the translations you want, and all those that are not overridden will fallback to the default translations provided by the application.

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

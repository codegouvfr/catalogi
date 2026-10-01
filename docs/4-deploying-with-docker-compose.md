<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Deploying the web app with docker-compose

## Requirements

To deploy the app using docker compose you need :

- Docker
- Docker Compose
- An OIDC provider like Keycloak, that is already independently deployed (see [Setting up Keycloak](3.2-setup-a-keycloak.md))

## Configure

There is an example of how to deploy Catalogi with docker-compose in [`deployment-examples/docker-compose`](https://github.com/codegouvfr/catalogi/tree/main/deployment-examples/docker-compose).

You can copy paste the folder. Then you will need a `.env` file to configure the environment variables. You can get it by copying the `.env.sample` file of the example and modifying it to your needs.

```bash
cp .env.sample .env
```

Then adjust the variables in the `.env` file to match your OIDC provider, your database and all. `APP_URL` must be the public URL of the instance, and `${APP_URL}/api/auth/callback` and `${APP_URL}/api/auth/logout/callback` must be allowed by your OIDC provider. Set `CATALOGI_INITIAL_ADMIN_EMAIL` to initialize the first administrator. [More details about the variables can be found here](6-env-variables-and-customization.md).

In `docker-compose.yml`, pin the `codegouvfr/catalogi-api` and `codegouvfr/catalogi-web` images to a specific version instead of `latest`.

You can change the way you handle the frontal part in the [nginx configuration file](https://github.com/codegouvfr/catalogi/blob/main/deployment-examples/docker-compose/nginx/default.conf).
The provided example is basic, and for example it does not provide support for `https` (you would need to configure it with your SSL certificates).

## UI configuration and translations

A new installation does not need any `ui-config.json`. The database migration inserts a standard UI configuration, which administrators then edit from **Administration → Interface configuration**.

The `customization` directory of the example is mounted in the API container for custom translations only. A legacy `ui-config.json` must only be placed there when upgrading an existing file-based installation. See [UI Configuration](6-env-variables-and-customization.md#ui-configuration).

## Start

Once everything is configured, you can run the following command to start the web app:

```bash
docker compose pull
docker compose up -d
```

The API applies the database migrations at startup. The application is then available on port `8090`.

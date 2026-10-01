<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Deploying a Catalogi instance

This is a simple example of how to deploy a Catalogi instance, using Docker and Docker Compose.

## Requirements

- Docker
- Docker Compose

## Configure

First, copy the `.env.sample` and name it `.env` in this directory.

```bash
cp .env.sample .env
```

Then, edit the `.env` file to set the environment variables. The API refuses to start without `APP_URL`, `OIDC_ISSUER_URI`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_MANAGE_PROFILE_URL`. See [Environment Variables and Customization](../../docs/6-env-variables-and-customization.md) for details.

You should pin the `catalogi-api` and `catalogi-web` images to a specific version in `docker-compose.yml` instead of `latest`.

## Auth Configuration

The `OIDC_*` values of `.env.sample` are placeholders: replace them with the ones of your OIDC provider (or use Keycloak to create your own, see [`../keycloak-docker-compose`](../keycloak-docker-compose)).

Set `CATALOGI_INITIAL_ADMIN_EMAIL` to the OIDC email of the first Catalogi administrator. See [Authentication](../../docs/3.1-authentication.md).

## Start

```bash
docker compose pull
docker compose up -d
```

The application is then available on http://localhost:8090, and Adminer on http://localhost:8091.

## UI configuration and translations

A new installation does not need any `ui-config.json`: the database migration inserts a standard UI configuration, which administrators edit from **Administration → Interface configuration**.

The `customization` directory is mounted in the API container for custom translations (`customization/translations/en.json` and `fr.json`). Only place a legacy `ui-config.json` there when upgrading an existing file-based installation: it is imported once on the first startup, then must be removed. See [UI Configuration](../../docs/6-env-variables-and-customization.md#ui-configuration).

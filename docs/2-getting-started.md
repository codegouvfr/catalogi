<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Getting started with Catalogi

## Run in local

To run the application in local, you need :

- docker and docker-compose, do setup the database, and local keycloak server.
- nodejs 22 and pnpm to run the web application (front and back)

1. Clone the repository

```bash
git clone git@github.com:codegouvfr/catalogi.git
```

2. Install the dependencies

```bash
cd catalogi
pnpm install
```

3. Create a `.env` file and set the environment variables as needed. You can copy the `.env.sample` file to start with a template.

```bash
cp .env.sample .env
```

Than you should adjust the variables in the `.env`, look at [the different variables here](6-env-variables-and-customization.md) for more details.

4. start the local resources with docker-compose

```bash
docker compose -f docker-compose.resources.yml up --build -d
```

5. load the database with some data by running seed

```bash
cd api && pnpm db:seed
```

6. start the frontend and backend in dev

```bash
pnpm dev # from the root, this will run both the frontend and backend `pnpm dev`
```

The docker-compose.resources.yml will start:

- a postgres database
- an adminer instance so that you can access the database with a UI (http://localhost:8082)
- a keycloak server (http://localhost:8080/) in dev mode, with a default admin user `admin` and password `admin`.

## Pushing a new version

When you want to push a new release, you need to update the version number in the root `package.json`.
The CI will :

- validate the code
- create a release on GitHub
- create the corresponding docker images and push them on docker hub :
  - [codegouvfr/catalogi-web](https://hub.docker.com/r/codegouvfr/catalogi-web/tags)
  - [codegouvfr/catalogi-api](https://hub.docker.com/r/codegouvfr/catalogi-api/tags)

## Deployments

You can deploy Catalogi with the following methods:

- [Docker Compose](4-deploying-with-docker-compose.md)
- [Kubernetes (with Helm charts)](5-deploying-with-kubernetes.md)

## Source code

All the source code is hosted on this repository.

The repository is the source code for 3 differents apps :

- `/web`: The web application, runs in the browser. The site is here : [https://code.gouv.fr/catalogi](https://code.gouv.fr/catalogi)
- `/api`: The RPC API consumed by the web application.
- `/docs`: The documentation. It is hosted on [https://codegouvfr.github.io/catalogi](https://codegouvfr.github.io/catalogi)

The data is held in a PostgreSQL database.

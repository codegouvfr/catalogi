<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Catalogi

Catalogi is a comprehensive tool that provides a catalog of software packages. It allows organizations to list, search, and manage software documentation and information in a modern web application.

This platform enables administrators and users to maintain curated catalogs of software with detailed metadata, documentation, and deployment information.

## Known deployments

The catalogi software is deployed on different places, such as :

1. [https://code.gouv.fr/sill](https://code.gouv.fr/sill/) for the
list of recommanded Free Software for French administrations.
2. [https://logiciels.catalogue-esr.fr/](https://logiciels.catalogue-esr.fr/) for the French Research Minister, listing mostly HAL softwares.

## Documentation Navigation

Use the sidebar on the left to navigate through the complete documentation:

### Getting Started
- **[Getting Started](2-getting-started.md)** - Set up and run Catalogi locally for development

### Authentication
- **[Authentication (OIDC)](3.1-authentication.md)** - Configure authentication with any OIDC provider
- **[Setting up Keycloak](3.2-setup-a-keycloak.md)** - Detailed Keycloak setup guide

### Deployment Guides
- **[Deploying with Docker Compose](4-deploying-with-docker-compose.md)** - Production deployment using Docker Compose
- **[Deploying with Kubernetes](5-deploying-with-kubernetes.md)** - Scalable deployment with Kubernetes
- **[Environment Variables and Customization](6-env-variables-and-customization.md)** - Configuration options and customization

### SILL-Specific Documentation
- **[SILL (French)](sill.md)** - Documentation spécifique au Socle Interministériel de Logiciels Libres
- **[SILL (English)](sill.en.md)** - SILL-specific documentation in English

## Source code

All the source code is hosted on the monorepo: [https://github.com/codegouvfr/catalogi](https://github.com/codegouvfr/catalogi).

It is the source code for 3 different apps:

* `/web`: The web application, runs in the browser.
* `/api`: The RPC API consumed by the web application. The code for different jobs is also in this folder.
* `/docs`: The documentation. It is hosted on [https://codegouvfr.github.io/catalogi](https://codegouvfr.github.io/catalogi)

The data is kept in a PostgreSQL database.

## Documentation

This documentation uses [docsify-dsfr-template](https://github.com/codegouvfr/docsify-dsfr-template) for its styling and structure.

## Contribute

See [CONTRIBUTING.md](../CONTRIBUTING.md).

## License

2021-2025 Direction interministérielle du numérique, mission logiciels libres.

Catalogi code is published under [licence MIT](../LICENSES/MIT.txt).

The documentation is published under [licence Ouverte 2.0](../LICENSES/Etalab-2.0.md).

# Deploying Catalogi with Helm

This directory contains examples for deploying Catalogi using Helm charts.

## Prerequisites

- Kubernetes cluster (1.19+)
- Helm 3.x installed
- kubectl configured to access your cluster

## Quick Start

For the complete deployment guide, including local Kubernetes setup and troubleshooting, see `../../docs/5-deploying-with-kubernetes.md`.

### 1. Add the Helm repository (if published)

```bash
# If published to a helm repository
helm repo add catalogi https://your-helm-repo.com
helm repo update
```

### 2. Install with default values

Default values are useful for rendering and smoke tests, but a real deployment must provide API environment variables and working ingress routing.

```bash
helm install catalogi catalogi/catalogi \
  --namespace catalogi \
  --create-namespace \
  -f your-values.yaml
```

### 3. Install from local chart

```bash
# From the root of this repository
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --create-namespace \
  -f your-values.yaml
```

## Local ingress routing

The web image serves static files with nginx. It does **not** proxy `/api` to the backend. Your ingress or external reverse proxy must route API calls explicitly.

Expected routing:

| Public path | Kubernetes service | Service port | Notes |
| ----------- | ------------------ | ------------ | ----- |
| `/` | `catalogi-web` | `80` | Static React app. |
| `/api(/|$)(.*)` | `catalogi-api` | `3000` | Strip `/api` with rewrite target `/$2`. |

For a local NGINX Ingress setup using release name `catalogi` and namespace `catalogi`, first copy `values-local-dev.yaml` and update `api.env` for your OIDC provider. `APP_URL` must match the browser URL, for example `http://catalogi.127.0.0.1.nip.io`.

Then install:

```bash
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --create-namespace \
  -f deployment-examples/helm/values-local-dev.yaml

kubectl apply -f deployment-examples/helm/ingress-api.yaml
kubectl apply -f deployment-examples/helm/ingress-web.yaml
```

Then test:

```bash
curl -i http://catalogi.127.0.0.1.nip.io/api/getRedirectUrl
curl -i http://catalogi.127.0.0.1.nip.io/api/fr/translations.json
```

Both responses must be JSON. If they return `text/html`, `index.html`, or an nginx HTML 404 page, `/api` is routed to the web nginx instead of the API service.

On Apple Silicon, if `codegouvfr/catalogi-web:latest` or `codegouvfr/catalogi-api:latest` cannot be pulled for `linux/arm64`, build the images locally and push them to a registry reachable by your local cluster.

## Configuration Examples

### Basic Configuration

See `values-basic.yaml` for a minimal production-ready configuration.

```bash
helm install catalogi ./helm-charts/catalogi --namespace catalogi --create-namespace -f deployment-examples/helm/values-basic.yaml
```

### Production Configuration

See `values-production.yaml` for a comprehensive production setup with:
- External PostgreSQL database
- TLS configuration
- Resource limits
- Security contexts

```bash
helm install catalogi ./helm-charts/catalogi --namespace catalogi --create-namespace -f deployment-examples/helm/values-production.yaml
```

### Development Configuration

See `values-development.yaml` for local development with:
- Adminer enabled
- Lower resource requirements
- Debug settings

```bash
helm install catalogi ./helm-charts/catalogi --namespace catalogi --create-namespace -f deployment-examples/helm/values-development.yaml
```

Note: `values-development.yaml` enables the chart-managed ingress. If your controller does not strip `/api`, use `values-local-dev.yaml` plus the split ingress examples above instead.

## Customization

The `customization` section of values.yaml mounts custom translations (`customization.translations`). The UI configuration is stored in the database and edited from **Administration → Interface configuration**: leave `customization.uiConfig` empty for a new installation, and only set it to import a legacy `ui-config.json` once when upgrading. See the [Customization section](../../docs/5-deploying-with-kubernetes.md#customization) of the Kubernetes guide.

Runtime variables of the web image (`VITE_HEAD`, `VITE_CSP`, `ENVIRONMENT`, `SENTRY_DSN_WEB`) are set with `web.env`.

## Monitoring Health

Check the status of your deployment:

```bash
kubectl get pods -l app.kubernetes.io/name=catalogi
kubectl get ingress
helm status catalogi
```

## Upgrading

```bash
helm upgrade catalogi ./helm-charts/catalogi -f your-values.yaml
```

## Uninstalling

```bash
helm uninstall catalogi
```

Note: This will not delete persistent volumes by default. Delete them manually if needed.
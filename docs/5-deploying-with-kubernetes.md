<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Deploying Catalogi with Kubernetes

This guide provides comprehensive instructions for deploying Catalogi on Kubernetes using Helm charts.

## Table of Contents

- [Prerequisites](#prerequisites)
- [How HTTP routing works](#how-http-routing-works)
- [Local Development Deployment](#local-development-deployment)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)
- [Migration from Docker Compose](#migration-from-docker-compose)

## Prerequisites

Before deploying Catalogi on Kubernetes, ensure you have:

- A running **Kubernetes cluster** (v1.19+). For local testing, you can enable Kubernetes in Docker Desktop.
- **kubectl** configured to access your cluster.
- **Helm 3.x** installed.
- An **Ingress controller**, such as NGINX or Traefik, installed in your cluster.

### Installing Prerequisites

#### kubectl (on macOS)

```bash
brew install kubectl
```

#### Helm (on macOS)

```bash
brew install helm
```

After installing Helm, you'll need to add the required repositories:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

#### NGINX Ingress Controller

If you don't have an ingress controller, you can install the NGINX one:

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx --create-namespace --namespace ingress-nginx
```

---

## How HTTP routing works

Catalogi is deployed as two HTTP services:

| Public path      | Kubernetes service | Service port | Notes                                                              |
| ---------------- | ------------------ | ------------ | ------------------------------------------------------------------ |
| `/`              | `catalogi-web`     | `80`         | Static React application served by nginx.                          |
| `/api(/\|$)(.*)` | `catalogi-api`     | `3000`       | Express/tRPC API. Strip `/api` before the request reaches the API. |

The web container's nginx only serves static files and the SPA fallback. It does **not** proxy `/api` to the backend. If `/api` reaches the web container, the browser receives `index.html` or an nginx HTML 404 page instead of JSON, and the frontend fails with a `JSON.parse`/tRPC error.

For NGINX Ingress, use two Ingress resources: one for the web route and one for the API route. This avoids applying the API rewrite annotation to `/`.

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
    - host: catalogi.example.org
      http:
        paths:
          - path: /api(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: catalogi-api
                port:
                  number: 3000
```

After every install, verify that API routes return JSON:

```bash
curl -i https://<your-host>/api/getRedirectUrl
curl -i https://<your-host>/api/fr/translations.json
```

---

## Local Development Deployment

This section deploys Catalogi on a local Kubernetes cluster for development and testing. It was tested with Docker Desktop Kubernetes in `kind` mode and NGINX Ingress.

### 1. Verify the cluster

```bash
kubectl get nodes
```

With Docker Desktop, Kubernetes must be enabled in Settings → Kubernetes. The node should be `Ready`.

### 2. Create a Namespace

```bash
kubectl create namespace catalogi
```

### 3. Add Required Helm Repositories

Add the Bitnami repository which contains the PostgreSQL dependency:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### 4. Install NGINX Ingress if needed

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --wait
```

### 5. Build Chart Dependencies

From the root of the repository, run the following command to fetch the PostgreSQL dependency:

```bash
helm dependency build ./helm-charts/catalogi
```

### 6. Deploy Catalogi

We provide an example values file that is pre-configured for local development. It uses the `latest` image tags and disables the chart-managed ingress so the local NGINX ingress examples can define the required API rewrite explicitly.

Before deploying, copy this file for your environment and update `api.env`. `APP_URL` must be the public browser URL of the instance, for example `http://catalogi.127.0.0.1.nip.io` locally or `https://catalogi.example.org` in production. The same URL must be allowed as an OIDC redirect/callback base by your identity provider if you want login to work. For a new instance, also set `api.env.CATALOGI_INITIAL_ADMIN_EMAIL` to the OIDC email of the first Catalogi administrator; after that user signs in, the value can be removed.

Deploy the chart using this file:

```bash
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --values ./deployment-examples/helm/values-local-dev.yaml
```

Then expose the application with the split local ingress examples:

```bash
kubectl apply -f ./deployment-examples/helm/ingress-api.yaml
kubectl apply -f ./deployment-examples/helm/ingress-web.yaml
```

These examples assume the release name is `catalogi` and the namespace is `catalogi`, which creates services named `catalogi-api` and `catalogi-web`.

On Apple Silicon, if the published `codegouvfr/catalogi-*` images are not available for `linux/arm64`, build local images and use them in your values file or push them to a registry reachable by your local cluster.

### 7. Check Deployment Status

It may take a few minutes for all the pods to become ready. You can monitor the status with:

```bash
kubectl get pods -n catalogi -w
```

Once all pods show `1/1` in the `READY` column, the deployment is complete.

The `catalogi-api` pod includes an `initContainer` that waits for the database to be ready before starting the application, which should prevent most startup issues.

### 8. Accessing the Application

The local ingress examples expose the application at `http://catalogi.127.0.0.1.nip.io` and `http://localhost`. You should be able to open one of these URLs in your browser to see the Catalogi frontend.

Verify that API requests reach the API service, not the web container:

```bash
curl -i http://catalogi.127.0.0.1.nip.io/api/getRedirectUrl
curl -i http://catalogi.127.0.0.1.nip.io/api/fr/translations.json
```

These responses must be JSON. If they return `text/html`, `index.html`, or an nginx HTML 404 page, `/api` is routed to the web nginx instead of the API service.

---

## Production Deployment

For production environments, it is crucial to use a dedicated values file with hardened security and resource configurations.

Start with the provided production example:

```bash
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --values deployment-examples/helm/values-production.yaml
```

### Production Checklist

- [ ] **Change default passwords** in your values file.
- [ ] **Configure an external database** for reliability and data persistence.
- [ ] **Set up TLS certificates** for secure HTTPS communication.
- [ ] **Configure resource requests and limits** to ensure stable performance.
- [ ] **Enable security contexts** as shown in the security section.
- [ ] **Configure backups** for your database and persistent volumes.

---

## Configuration

Catalogi is configured using Helm values. You can find examples in `deployment-examples/helm/`. Always create a copy of an example file and modify it for your environment rather than editing the examples directly.

### Important Parameters

| Parameter                                   | Description                                                                                                                             | Default                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `ingress.hosts[0].host`                     | Application domain name for chart-managed ingress.                                                                                      | `catalogi.local`            |
| `api.env.APP_URL`                           | Public browser URL. Used for CORS and auth redirects.                                                                                   | must be set                 |
| `api.env.OIDC_ISSUER_URI`                   | OIDC provider URL.                                                                                                                      | must be set                 |
| `api.env.OIDC_CLIENT_ID`                    | OIDC client ID.                                                                                                                         | must be set                 |
| `api.env.OIDC_CLIENT_SECRET`                | OIDC client secret. Store with care in production.                                                                                      | must be set                 |
| `api.env.OIDC_MANAGE_PROFILE_URL`           | User profile management URL.                                                                                                            | must be set                 |
| `database.password`                         | Database password.                                                                                                                      | `change-this-in-production` |
| `postgresql.enabled`                        | Use the built-in PostgreSQL chart.                                                                                                      | `true`                      |
| `customization.enabled`                     | Enable the ConfigMap used for custom translations and the optional legacy UI configuration import.                                      | `false`                     |
| `customization.legacyUiConfigImportEnabled` | Mount `customization.uiConfig` for the one-time database migration. Disable it after verifying the import; translations remain mounted. | `true`                      |

**Note:** the API validates required environment variables at startup. Missing OIDC variables or `APP_URL` make the API pod crash before serving traffic.

---

## Troubleshooting

### Common Issues

#### Frontend error: `JSON.parse: unexpected character` on `/api/getRedirectUrl`

This usually means `/api` is routed to the web container instead of the API service. The web image contains an nginx server for static files only; it does not proxy API calls. Its SPA fallback can return `index.html` for `/api/...`, which then makes tRPC fail while parsing HTML as JSON.

Expected routing:

- `/` → `catalogi-web` service, port `80`
- `/api(/|$)(.*)` → `catalogi-api` service, port `3000`, with rewrite target `/$2`

For NGINX Ingress, use the split examples:

```bash
kubectl apply -f ./deployment-examples/helm/ingress-api.yaml
kubectl apply -f ./deployment-examples/helm/ingress-web.yaml
```

Quick diagnosis:

```bash
curl -i https://<your-host>/api/getRedirectUrl
curl -i https://<your-host>/api/fr/translations.json
```

If the response is `text/html`, `index.html`, or an nginx 404 HTML page, fix the ingress/proxy before debugging ProConnect.

#### API pod crashes with missing OIDC or `APP_URL` variables

The API requires these environment variables:

- `OIDC_ISSUER_URI`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_MANAGE_PROFILE_URL`
- `APP_URL`

`APP_URL` must match the public URL used by the browser. It is used for CORS and authentication redirects.

#### Pods are stuck in `ErrImagePull` or `ImagePullBackOff`

This usually means the image tag specified in your values file does not exist or is not available for your CPU architecture. If you specify a version, ensure it exists on Docker Hub.

**For Apple Silicon (ARM64) users:** if you encounter `no matching manifest for linux/arm64/v8`, the published image is not available for your local architecture. Options:

1. Build ARM images locally and push them to a registry reachable by the cluster.
2. Load local images into your local cluster if your cluster tool supports it.
3. Use an amd64-capable cluster or enable amd64 emulation if your Kubernetes runtime supports it.

Docker Desktop Kubernetes in `kind` mode may not see images from the local Docker daemon directly. During local debugging, pushing local images to a temporary registry such as `ttl.sh` can unblock tests:

```bash
docker build --target web -t catalogi-web:local -f Dockerfile.web .
docker build -t catalogi-api:local -f Dockerfile.api .

IMAGE_SUFFIX=$(date +%s)
WEB_IMAGE=ttl.sh/catalogi-web-${IMAGE_SUFFIX}:1h
API_IMAGE=ttl.sh/catalogi-api-${IMAGE_SUFFIX}:1h

docker tag catalogi-web:local ${WEB_IMAGE}
docker tag catalogi-api:local ${API_IMAGE}
docker push ${WEB_IMAGE}
docker push ${API_IMAGE}

helm upgrade --install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --create-namespace \
  --values ./deployment-examples/helm/values-local-dev.yaml \
  --set web.image.repository=${WEB_IMAGE%:*} \
  --set web.image.tag=${WEB_IMAGE##*:} \
  --set api.image.repository=${API_IMAGE%:*} \
  --set api.image.tag=${API_IMAGE##*:} \
  --set update.image.repository=${API_IMAGE%:*} \
  --set update.image.tag=${API_IMAGE##*:}
```

Do not use temporary registries for production.

#### Database Connection Errors (`ECONNREFUSED`)

The logs for the `catalogi-api` pod show `Error: connect ECONNREFUSED`. This means the API could not connect to the database. The chart includes an `initContainer` to prevent the API from starting before the database is ready, but if this issue occurs, check your database service's status and network policies.

#### Readiness Probe Failing

If `kubectl describe pod catalogi-api...` shows readiness probe failures (often with a 404 status code), it means the health check endpoint is not responding correctly.

- The correct health check path for the API is `/public/healthcheck`.
- This is configured in the `livenessProbe` and `readinessProbe` sections of the `api-deployment.yaml` template.

### Debugging Commands

```bash
# Get all resources in the namespace
kubectl get all -n catalogi

# Describe a pod to see its configuration and events
kubectl describe pod <pod-name> -n catalogi

# View the logs of a pod
kubectl logs <pod-name> -n catalogi

# Check events in the namespace for errors
kubectl get events -n catalogi --sort-by='.lastTimestamp'
```

## Migration from Docker Compose

To migrate from an existing Docker Compose deployment:

### 1. Export existing data

```bash
# From your docker-compose directory
docker-compose exec postgres pg_dump -U db_user db > catalogi-backup.sql
```

### 2. Deploy Helm chart

```bash
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --values your-production-values.yaml
```

### 3. Import data

```bash
# Copy backup to pod
kubectl cp catalogi-backup.sql catalogi/catalogi-postgresql-0:/tmp/

# Restore database
kubectl exec -n catalogi catalogi-postgresql-0 -- \
  psql -U catalogi_user catalogi_db < /tmp/catalogi-backup.sql
```

### 4. Update configuration

Migrate your Docker Compose environment variables to Helm values:

- `DATABASE_URL` → `database.*` values
- `OIDC_*` → `api.env.OIDC_*`
- `VITE_*` → the initial `customization.uiConfig`; after the first startup, edit the UI configuration from the administration page

## Security Considerations

### Production Security

- **Use external database** with proper access controls
- **Enable TLS** for all communications
- **Set resource limits** to prevent resource exhaustion
- **Use network policies** to restrict pod-to-pod communication
- **Regular security updates** of container images
- **Backup encryption** for sensitive data

### Example Security Configuration

```yaml
web:
  podSecurityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
  securityContext:
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]

api:
  podSecurityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
  securityContext:
    allowPrivilegeEscalation: false
    capabilities:
      drop: ["ALL"]
```

## Support

For issues and questions:

- Check the [troubleshooting section](#troubleshooting)
- Review [GitHub Issues](https://github.com/codegouvfr/catalogi/issues)
- Consult the [deployment examples](../deployment-examples/helm/)

## Next Steps

After successful deployment:

1. **Configure authentication** (OIDC/Keycloak)
2. **Customize the UI** to match your organization
3. **Set up monitoring** and alerting
4. **Configure backups** and disaster recovery
5. **Review security settings** for your environment

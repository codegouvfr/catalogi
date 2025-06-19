<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Deploying Catalogi with Kubernetes

This guide provides comprehensive instructions for deploying Catalogi on Kubernetes using Helm charts.

## Table of Contents

- [Prerequisites](#prerequisites)
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

## Local Development Deployment

This section will guide you through deploying Catalogi on a local Kubernetes cluster for development and testing purposes.

### 1. Create a Namespace

```bash
kubectl create namespace catalogi
```

### 2. Add Required Helm Repositories

Add the Bitnami repository which contains the PostgreSQL dependency:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### 3. Build Chart Dependencies

From the root of the repository, run the following command to fetch the PostgreSQL dependency:

```bash
helm dependency build ./helm-charts/catalogi
```

### 4. Deploy Catalogi

We provide an example values file that is pre-configured for local development. It uses the `latest` image tags and sets up a functional ingress configuration.

Deploy the chart using this file:

```bash
helm install catalogi ./helm-charts/catalogi --namespace catalogi --values ./deployment-examples/helm/values-local-dev.yaml
```

### 5. Check Deployment Status

It may take a few minutes for all the pods to become ready. You can monitor the status with:

```bash
kubectl get pods -n catalogi -w
```

Once all pods show `1/1` in the `READY` column, the deployment is complete.

The `catalogi-api` pod includes an `initContainer` that waits for the database to be ready before starting the application, which should prevent most startup issues.

### 6. Accessing the Application

The local development values configure the ingress to be accessible at `http://catalogi.127.0.0.1.nip.io`. You should be able to open this URL in your browser to see the Catalogi frontend.

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

| Parameter                 | Description                       | Default                     |
| ------------------------- | --------------------------------- | --------------------------- |
| `ingress.hosts[0].host`   | Your application's domain name    | `catalogi.local`            |
| `api.env.OIDC_ISSUER_URI` | **Required** OIDC provider URL    | `""`                        |
| `api.env.OIDC_CLIENT_ID`  | **Required** OIDC client ID       | `""`                        |
| `database.password`       | Database password                 | `change-this-in-production` |
| `postgresql.enabled`      | Use the built-in PostgreSQL chart | `true`                      |

**Note:** The `OIDC_ISSUER_URI` and `OIDC_CLIENT_ID` environment variables for the API are mandatory. The application will not start without them.

---

## Troubleshooting

### Common Issues

#### Pods are stuck in `ErrImagePull` or `ImagePullBackOff`

This usually means the image tag specified in your values file does not exist. The default chart now uses the `latest` tag, which is generally available. If you specify a version, ensure it exists on Docker Hub.

**For Apple Silicon (ARM64) users:** If you encounter errors like `no matching manifest for linux/arm64/v8`, you need to manually pull the AMD64 images:

```bash
docker pull --platform linux/amd64 codegouvfr/catalogi-web:latest
docker pull --platform linux/amd64 codegouvfr/catalogi-api:latest
```

The local development values file has been configured with `pullPolicy: IfNotPresent` to use local images once pulled.

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
- `VITE_*` → `customization.uiConfig`

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

<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Deploying Catalogi with Kubernetes

This guide provides comprehensive instructions for deploying Catalogi on Kubernetes using Helm charts.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Production Deployment](#production-deployment)
- [Development Setup](#development-setup)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)
- [Migration from Docker Compose](#migration-from-docker-compose)

## Prerequisites

Before deploying Catalogi on Kubernetes, ensure you have:

- **Kubernetes cluster** (version 1.19 or later)
- **Helm 3.x** installed and configured
- **kubectl** configured to access your cluster
- **Ingress controller** (nginx, traefik, etc.)
- **Cert-manager** (optional, for automatic TLS certificates)

### Installing Prerequisites

#### Helm 3.x
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

#### Ingress Controller (NGINX example)
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --create-namespace \
  --namespace ingress-nginx
```

#### Cert-Manager (optional)
```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

## Quick Start

### 1. Create a namespace
```bash
kubectl create namespace catalogi
```

### 2. Deploy with default values
```bash
# From the root of this repository
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --set ingress.hosts[0].host=catalogi.yourdomain.com \
  --set database.password=your-secure-password
```

### 3. Check deployment status
```bash
kubectl get pods -n catalogi
kubectl get ingress -n catalogi
```

## Configuration

Catalogi can be configured using Helm values. See the example configurations in [`deployment-examples/helm/`](../deployment-examples/helm/).

### Basic Configuration

For a simple production deployment:

```bash
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --values deployment-examples/helm/values-basic.yaml
```

### Important Configuration Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.hosts[0].host` | Your domain name | `catalogi.local` |
| `database.password` | Database password | `change-this-in-production` |
| `postgresql.enabled` | Enable built-in PostgreSQL | `true` |
| `database.externalHost` | External database host | `""` |
| `customization.enabled` | Enable UI customization | `true` |

## Production Deployment

For production environments, use the production values file:

```bash
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --values deployment-examples/helm/values-production.yaml
```

### Production Checklist

- [ ] **Change default passwords** in `values-production.yaml`
- [ ] **Configure external database** (recommended)
- [ ] **Set up TLS certificates** (cert-manager or manual)
- [ ] **Configure proper resource limits**
- [ ] **Enable security contexts**
- [ ] **Set up monitoring and logging**
- [ ] **Configure backups**

### External Database Configuration

For production, it's recommended to use an external PostgreSQL database:

```yaml
# In your values file
database:
  externalHost: "postgres.yourdomain.com"
  user: "catalogi_user"
  db: "catalogi_db"
  password: "your-secure-password"
  existingSecret: "catalogi-db-secret"  # Optional: use existing secret

postgresql:
  enabled: false  # Disable built-in PostgreSQL
```

Create the database secret:
```bash
kubectl create secret generic catalogi-db-secret \
  --namespace catalogi \
  --from-literal=database-url="postgresql://user:password@host:5432/database" \
  --from-literal=database-password="your-secure-password"
```

## Development Setup

For development and testing:

```bash
helm install catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --values deployment-examples/helm/values-development.yaml
```

This configuration includes:
- **Adminer** for database management
- **Lower resource requirements**
- **Latest image tags** with frequent updates
- **Simplified ingress** without TLS

## Customization

### UI Customization

Customize the appearance and behavior through the `customization` section:

```yaml
customization:
  enabled: true
  uiConfig: |-
    {
      "organizationFullName": "Your Organization",
      "organizationShortName": "YourOrg",
      "websiteUrl": "https://yourorg.com",
      "logoUrl": "https://yourorg.com/logo.png",
      "termsOfServiceUrl": "https://yourorg.com/terms"
    }
  translations:
    en: |-
      {
        "welcome": "Welcome to our software catalog",
        "description": "Discover and evaluate open source software"
      }
    fr: |-
      {
        "welcome": "Bienvenue dans notre catalogue logiciel",
        "description": "Découvrez et évaluez les logiciels open source"
      }
```

### Environment Variables

Configure the API through environment variables:

```yaml
api:
  env:
    EXTERNAL_SOFTWARE_DATA_ORIGIN: "wikidata"
    TERMS_OF_SERVICE_URL: "https://yourorg.com/terms"
    OIDC_ISSUER_URI: "https://auth.yourorg.com/realms/yourrealm"
    OIDC_CLIENT_ID: "catalogi"
```

### Authentication Setup

For OIDC authentication (Keycloak, etc.):

```yaml
api:
  env:
    OIDC_ISSUER_URI: "https://auth.yourorg.com/realms/yourrealm"
    OIDC_CLIENT_ID: "catalogi"
    # Additional OIDC configuration...
```

## Upgrading

To upgrade an existing deployment:

```bash
# Update to new chart version
helm upgrade catalogi ./helm-charts/catalogi \
  --namespace catalogi \
  --values your-values.yaml

# Check rollout status
kubectl rollout status deployment/catalogi-web -n catalogi
kubectl rollout status deployment/catalogi-api -n catalogi
```

## Monitoring and Maintenance

### Health Checks

Monitor the health of your deployment:

```bash
# Check pod status
kubectl get pods -n catalogi

# Check logs
kubectl logs -f deployment/catalogi-api -n catalogi
kubectl logs -f deployment/catalogi-web -n catalogi

# Check ingress
kubectl get ingress -n catalogi
```

### Scaling

Scale components as needed:

```bash
# Scale web frontend
kubectl scale deployment catalogi-web --replicas=3 -n catalogi

# Scale API backend
kubectl scale deployment catalogi-api --replicas=2 -n catalogi
```

### Backup and Restore

#### Database Backup

If using the built-in PostgreSQL:

```bash
# Create backup
kubectl exec -n catalogi catalogi-postgresql-0 -- \
  pg_dump -U catalogi_user catalogi_db > backup.sql

# Restore backup
kubectl exec -i -n catalogi catalogi-postgresql-0 -- \
  psql -U catalogi_user catalogi_db < backup.sql
```

## Troubleshooting

### Common Issues

#### Pods stuck in Pending state
```bash
kubectl describe pod <pod-name> -n catalogi
# Check for resource constraints or node selector issues
```

#### Database connection errors
```bash
kubectl logs deployment/catalogi-api -n catalogi
# Check DATABASE_URL and database connectivity
```

#### Ingress not working
```bash
kubectl describe ingress catalogi -n catalogi
# Check DNS resolution and ingress controller logs
```

### Debugging Commands

```bash
# Get all resources
kubectl get all -n catalogi

# Describe deployments
kubectl describe deployment catalogi-web -n catalogi
kubectl describe deployment catalogi-api -n catalogi

# Check events
kubectl get events -n catalogi --sort-by='.lastTimestamp'

# Port forward for local access
kubectl port-forward service/catalogi-web 8080:80 -n catalogi
kubectl port-forward service/catalogi-api 3000:3000 -n catalogi
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
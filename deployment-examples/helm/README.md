# Deploying Catalogi with Helm

This directory contains examples for deploying Catalogi using Helm charts.

## Prerequisites

- Kubernetes cluster (1.19+)
- Helm 3.x installed
- kubectl configured to access your cluster

## Quick Start

### 1. Add the Helm repository (if published)

```bash
# If published to a helm repository
helm repo add catalogi https://your-helm-repo.com
helm repo update
```

### 2. Install with default values

```bash
helm install catalogi catalogi/catalogi
```

### 3. Install from local chart

```bash
# From the root of this repository
helm install catalogi ./helm-charts/catalogi
```

## Configuration Examples

### Basic Configuration

See `values-basic.yaml` for a minimal production-ready configuration.

```bash
helm install catalogi ./helm-charts/catalogi -f deployment-examples/helm/values-basic.yaml
```

### Production Configuration

See `values-production.yaml` for a comprehensive production setup with:
- External PostgreSQL database
- TLS configuration
- Resource limits
- Security contexts

```bash
helm install catalogi ./helm-charts/catalogi -f deployment-examples/helm/values-production.yaml
```

### Development Configuration

See `values-development.yaml` for local development with:
- Adminer enabled
- Lower resource requirements
- Debug settings

```bash
helm install catalogi ./helm-charts/catalogi -f deployment-examples/helm/values-development.yaml
```

## Customization

The chart supports extensive customization through the `customization` section in values.yaml. See the example files for different configuration patterns.

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
#!/bin/bash
set -e

echo "🔍 Testing Catalogi Helm Charts..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
echo "🔧 Checking prerequisites..."

if ! command -v helm &> /dev/null; then
    print_error "Helm is not installed. Please install Helm 3.x first."
    echo "Install with: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

print_status "Prerequisites check passed"

# Test 1: Lint the charts
echo "🧹 Linting Helm charts..."
if helm lint ./helm-charts/catalogi; then
    print_status "Chart linting passed"
else
    print_error "Chart linting failed"
    exit 1
fi

# Test 2: Template rendering
echo "📋 Testing template rendering..."
if helm template catalogi ./helm-charts/catalogi \
    --values deployment-examples/helm/values-development.yaml \
    --output-dir /tmp/catalogi-test > /dev/null; then
    print_status "Template rendering successful"
    echo "Generated templates are in /tmp/catalogi-test/"
else
    print_error "Template rendering failed"
    exit 1
fi

# Test 3: Dry run
echo "🏃 Performing dry run..."
if kubectl cluster-info &> /dev/null; then
    print_status "Kubernetes cluster detected"
    
    if helm install catalogi-test ./helm-charts/catalogi \
        --namespace catalogi-test \
        --create-namespace \
        --values deployment-examples/helm/values-development.yaml \
        --dry-run > /dev/null; then
        print_status "Dry run successful"
    else
        print_error "Dry run failed"
        exit 1
    fi
else
    print_warning "No Kubernetes cluster detected - skipping dry run"
    echo "To test with a real cluster:"
    echo "  - Use minikube: 'minikube start'"
    echo "  - Use kind: 'kind create cluster'"
    echo "  - Use Docker Desktop Kubernetes"
fi

# Test 4: Validate values files
echo "📝 Validating values files..."
for values_file in deployment-examples/helm/values-*.yaml; do
    echo "  Testing $(basename $values_file)..."
    if helm template catalogi ./helm-charts/catalogi \
        --values "$values_file" > /dev/null; then
        print_status "$(basename $values_file) is valid"
    else
        print_error "$(basename $values_file) validation failed"
        exit 1
    fi
done

echo ""
echo "🎉 All tests passed! Your Helm charts are ready to deploy."
echo ""
echo "Next steps:"
echo "  1. Start a local cluster: kind create cluster"
echo "  2. Deploy: helm install catalogi ./helm-charts/catalogi --namespace catalogi --create-namespace --values deployment-examples/helm/values-development.yaml"
echo "  3. Check status: kubectl get pods -n catalogi"
echo "  4. Access locally: kubectl port-forward service/catalogi-web 8080:80 -n catalogi"
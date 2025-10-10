<!-- SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr> -->
<!-- SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- SPDX-License-Identifier: Etalab-2.0 -->

# Setting up Keycloak for Production

This document explains how to set up a production-ready Keycloak instance for authentication with the Catalogi project.

## Overview

Catalogi supports OpenID Connect (OIDC) authentication through Keycloak. This guide covers:

1. **Development Setup**: Using the built-in dev Keycloak in `docker-compose.resources.yml`
2. **Production Setup**: Using the standalone production-ready Keycloak in `deployment-examples/keycloak-docker-compose/`
3. **Configuration**: How to configure Catalogi to use your Keycloak instance

## Development Setup

For local development, the project includes a simple Keycloak setup in `docker-compose.resources.yml`:

```bash
# Start the development services
docker-compose -f docker-compose.resources.yml up -d

# Access Keycloak admin console
# URL: http://localhost:8080/admin
# Username: admin
# Password: admin
```

This development setup:

- Uses the H2 in-memory database (data is lost on restart)
- Imports the `catalogi-realm.json` configuration
- Runs on port 8080
- Has the admin credentials hardcoded as admin/admin

**⚠️ Do not use this setup in production!**

## Production Setup

For production, use the dedicated Keycloak setup in `deployment-examples/keycloak-docker-compose/`:

### Quick Start

```bash
# Navigate to the keycloak deployment directory
cd deployment-examples/keycloak-docker-compose

# Copy the environment template
cp .env.sample .env

# Edit the environment file with your settings
nano .env

# Start the services
docker-compose up -d

# Check the logs
docker-compose logs -f keycloak
```

### Key Differences from Development

| Aspect            | Development        | Production                              |
| ----------------- | ------------------ | --------------------------------------- |
| Database          | H2 (in-memory)     | PostgreSQL (persistent)                 |
| Data Persistence  | ❌ Lost on restart | ✅ Persistent                           |
| Admin Credentials | Hardcoded          | Configurable via `.env`                 |
| Port              | 8080               | 8082 (configurable)                     |
| Security          | Basic              | Enhanced (brute force protection, etc.) |
| Health Checks     | ❌ None            | ✅ Built-in                             |
| Realm             | `catalogi`         | `simple`                                |

### Environment Configuration

The production setup uses environment variables for configuration:

```bash
# Database Configuration
POSTGRES_DB=keycloak
POSTGRES_USER=keycloak
POSTGRES_PASSWORD=change_me_in_production

# Keycloak Admin Configuration
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=change_me_in_production

# Keycloak Hostname Configuration
KC_HOSTNAME=localhost
KC_HOSTNAME_PORT=8082

# Port Configuration
KEYCLOAK_PORT=8082

# Logging Configuration
KC_LOG_LEVEL=INFO
```

**🔒 Security Note**: Always change the default passwords in production!

### Accessing the Production Setup

Once started, access your Keycloak instance at:

- **Admin Console**: http://localhost:8092/admin
- **Simple Realm**: http://localhost:8092/realms/simple
- **OIDC Discovery**: http://localhost:8092/realms/simple/.well-known/openid_configuration

## Configuring Catalogi to Use Keycloak

### Environment Variables

To configure Catalogi to use your Keycloak instance, set these environment variables:

```bash
# For the development setup (docker-compose.resources.yml)
OIDC_ISSUER=http://localhost:8080/realms/catalogi
OIDC_CLIENT_ID=catalogi

# For the production setup (keycloak-docker-compose)
OIDC_ISSUER=http://localhost:8092/realms/simple
OIDC_CLIENT_ID=my-app
```

### Integration with Main Catalogi Deployment

If you're using the main Catalogi deployment (`deployment-examples/docker-compose/`), you can integrate with the production Keycloak:

1. **Start the Keycloak setup first**:

   ```bash
   cd deployment-examples/keycloak-docker-compose
   docker-compose up -d
   ```

2. **Configure the main deployment**:
   Edit `deployment-examples/docker-compose/.env`:

   ```bash
   # Add these OIDC configuration variables
   OIDC_ISSUER=http://localhost:8092/realms/simple
   OIDC_CLIENT_ID=my-app
   ```

3. **Start the main Catalogi deployment**:
   ```bash
   cd deployment-examples/docker-compose
   docker-compose up -d
   ```

The main Catalogi deployment (running on port 8090) is already configured as an allowed redirect URI in the production Keycloak setup.

## Realm Configuration

### Development Realm (`catalogi`)

The development realm includes:

- Complex user profile with multiple attributes
- Configured for the main Catalogi application
- Localhost:3000 redirect URIs

### Production Realm (`simple`)

The production realm is optimized for simplicity:

- **Email-only registration**: Users only need email and password
- **No additional attributes**: Simplified user profile
- **Multiple redirect URIs**: Supports both localhost:3000 and localhost:8090
- **Self-registration enabled**: Users can create accounts
- **Password reset enabled**: Users can reset passwords
- **Brute force protection**: Enhanced security

### Client Configuration

The production setup includes a pre-configured client:

```json
{
  "clientId": "my-app",
  "publicClient": true,
  "redirectUris": [
    "http://localhost:3000/*",
    "https://localhost:3000/*",
    "http://localhost:8090/*"
  ],
  "webOrigins": [
    "http://localhost:3000",
    "https://localhost:3000",
    "http://localhost:8090"
  ]
}
```

## Production Deployment Considerations

### Security Checklist

- [ ] Change default admin password
- [ ] Change default database password
- [ ] Set proper hostname for your domain
- [ ] Enable HTTPS (use reverse proxy)
- [ ] Configure proper CORS origins
- [ ] Set up database backups
- [ ] Monitor logs and health endpoints
- [ ] Update container images regularly

### Domain Configuration

For production with a custom domain:

```bash
# In your .env file
KC_HOSTNAME=auth.yourdomain.com
KC_HOSTNAME_PORT=443
KEYCLOAK_PORT=8082  # Internal port, reverse proxy handles external
```

### Reverse Proxy Setup

Use a reverse proxy like nginx to handle HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name auth.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Port Configuration

The Catalogi project uses different ports to avoid conflicts:

| Service                 | Port     | Usage                                 |
| ----------------------- | -------- | ------------------------------------- |
| Development Postgres    | 5432     | `docker-compose.resources.yml`        |
| Development Keycloak    | 8080     | `docker-compose.resources.yml`        |
| Development Adminer     | 8081     | `docker-compose.resources.yml`        |
| **Production Keycloak** | **8082** | `keycloak-docker-compose/`            |
| Main Catalogi (nginx)   | 8090     | `deployment-examples/docker-compose/` |
| Main Catalogi Adminer   | 8092     | `deployment-examples/docker-compose/` |

## Troubleshooting

### Common Issues

1. **Port conflicts**: Make sure ports 8082 and 5432 are available
2. **Database connection**: Check PostgreSQL is healthy before Keycloak starts
3. **Realm import**: Verify `simple-realm.json` is properly mounted
4. **Redirect URIs**: Ensure your application URL is in the client configuration

### Useful Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f keycloak
docker-compose logs -f postgres

# Restart services
docker-compose restart

# Database backup
docker-compose exec postgres pg_dump -U keycloak keycloak > backup.sql

# Health check
curl http://localhost:8082/health/ready
```

### Log Analysis

Enable debug logging by setting `KC_LOG_LEVEL=DEBUG` in your `.env` file:

```bash
# Edit .env
KC_LOG_LEVEL=DEBUG

# Restart Keycloak
docker-compose restart keycloak

# Follow debug logs
docker-compose logs -f keycloak
```

## Migration from Development to Production

If you've been using the development Keycloak and want to migrate to production:

1. **Export your realm configuration** from the development setup
2. **Stop the development Keycloak**
3. **Customize the realm file** in the production setup
4. **Update your application configuration** to use the new issuer URL and client ID
5. **Start the production setup**
6. **Re-create users** or import them from the development realm

## Support and Documentation

- **Keycloak Official Documentation**: https://www.keycloak.org/documentation
- **Docker Compose Reference**: https://docs.docker.com/compose/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **OIDC Specification**: https://openid.net/connect/

For issues specific to this Catalogi integration, check the project's GitHub issues or create a new one with detailed logs and configuration.

#!/bin/bash
set -e

# This script creates multiple databases in PostgreSQL
# Based on POSTGRES_MULTIPLE_DATABASES environment variable

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Create mcp_gateway database
    CREATE DATABASE mcp_gateway;
    GRANT ALL PRIVILEGES ON DATABASE mcp_gateway TO $POSTGRES_USER;

    -- Create keycloak database
    CREATE DATABASE keycloak;
    GRANT ALL PRIVILEGES ON DATABASE keycloak TO $POSTGRES_USER;

    -- List databases to confirm
    \l
EOSQL

echo "✅ Databases created successfully: mcp_gateway, keycloak"

#!/bin/bash
# ============================================================
# Consultio Med - Database Initialization Script
# ============================================================
# Este script e executado automaticamente quando o container
# PostgreSQL e iniciado pela primeira vez.
# ============================================================

set -e

echo "[INIT-DB] Inicializando banco de dados do Consultio Med..."

# Create extensions
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "citext";
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

echo "[INIT-DB] Extensions criadas com sucesso."

# Nota: As tabelas sao criadas automaticamente pelo
# 'runMigrations()' no server/database.ts quando a
# aplicacao iniciar pela primeira vez.
#
# Para uma estrutura mais completa com planos, RLS,
# e multi-tenant, execute manualmente:
#   supabase/migrations/20260526190000_initial_saas_foundation.sql

echo "[INIT-DB] Inicializacao concluida."

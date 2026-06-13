# Consultio Med - Deploy Guide

> **Status:** Pronto para producao
> - ✅ TypeScript sem erros | ✅ Build otimizado
> - ✅ CORS restrito | ✅ Rate limiting | ✅ Helmet + CSP
> - ✅ JWT + MFA + Refresh Token Rotation | ✅ Criptografia AES-256-GCM
> - ✅ LGPD | ✅ Auditoria | ✅ Backup criptografado
> - ✅ CI/CD (GitHub Actions) | ✅ Security audit scripts
> - ✅ Dual-write PG/JSON otimizado
> - ✅ Docker secrets support | ✅ JWT key rotation
> - ✅ File upload validation (whitelist MIME/ext)
> - ✅ Password policy (8+ chars, maiuscula, minuscula, numero, especial)

## Sumario

1. [Arquitetura](#1-arquitetura)
2. [Deploy Local (Docker Compose)](#2-deploy-local-docker-compose)
3. [Deploy Producao (Portainer)](#3-deploy-producao-portainer)
4. [Variaveis de Ambiente](#4-variaveis-de-ambiente)
5. [Banco de Dados](#5-banco-de-dados)
6. [WhatsApp Bridge](#6-whatsapp-bridge)
7. [Manutencao](#7-manutencao)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Arquitetura

```
                      ┌─────────────┐
                      │   Caddy     │  Portas 80/443 (HTTPS)
                      │  Reverse    │  SSL automatico (Let's Encrypt)
                      │   Proxy     │
                      └──────┬──────┘
                             │ http://consultio-med:5173
                      ┌──────┴──────┐
                      │ consultio-  │  Porta 5173 (interno)
                      │   med       │  React + Express + TypeScript
                      │  (Node.js)  │
                      └──┬───────┬──┘
                      ┌──┴──┐ ┌──┴──────────┐
                      │     │ │  whatsmeow- │  Porta 8080 (interno)
                      │     │ │   bridge    │  Go + whatsmeow library
                      │     │ │   (Go)      │
                      │     │ └─────────────┘
                      │  ┌──┴──────────────┐
                      │  │   Supabase      │  PostgreSQL gerenciado
                      │  │  (externo)      │  (pooler.supabase.com)
                      │  └─────────────────┘
```

## 2. Deploy Local (Docker Compose)

### Pre-requisitos
- Docker e Docker Compose
- Git

### Passos

```bash
# 1. Clone o repositorio
git clone <seu-repositorio> consultio-med
cd consultio-med

# 2. Copie e configure o .env
cp .env.example .env
# Edite .env com seus valores (JWT_SECRET, ENCRYPTION_MASTER_KEY, DB_PASSWORD, etc.)

# 3. Suba a stack completa
docker compose up --build -d

# 4. Verifique os logs
docker compose logs -f consultio-med
```

Acesse: http://localhost:5173

### Security Scripts

```bash
# Auditoria de seguranca (checa configuracoes)
npm run security:audit

# Testes de penetracao automatizados (requer servidor rodando)
npm run security:test

# Ambos
npm run security:full
```

### Comandos uteis

```bash
# Ver status
docker compose ps

# Ver logs de um servico especifico
docker compose logs -f consultio-med
docker compose logs -f whatsmeow-bridge
docker compose logs -f postgres
docker compose logs -f caddy

# Parar tudo
docker compose down

# Parar e remover volumes (cuidado: perde dados!)
docker compose down -v

# Reconstruir e reiniciar um servico
docker compose up -d --build consultio-med

# Executar comando dentro do container
docker compose exec consultio-med node -e "console.log('ok')"

# Backup manual do banco
docker compose exec postgres pg_dump -U consultio consultio > backup.sql
```

### Modo Supabase (sem PostgreSQL local)

```bash
docker compose -f docker-compose.supabase.yml up --build -d
```

## 3. Deploy Producao (Portainer)

### Pre-requisitos no servidor
- Servidor Linux (Ubuntu 22.04+ recomendado)
- Docker e Portainer instalados
- Dominio apontando para o IP do servidor (DNS A record)
- Portas 80 e 443 liberadas no firewall

### Passo a passo

#### 3.1 Preparar repositorio Git

Envie o codigo para um repositorio Git (GitHub, GitLab, etc.).

#### 3.2 Criar stack no Portainer

1. Acesse o painel Portainer
2. Va em **Stacks** > **Add stack**
3. Preencha:
   - **Name**: `consultio-med`
   - **Build method**: `Git Repository`
   - **Repository URL**: URL do seu repositorio
   - **Repository reference**: `refs/heads/codex/beta-test-hardening` (ou sua branch)
   - **Compose path**: `deploy/portainer-stack.yml`
4. As variaveis de ambiente ja estao preenchidas com valores default no proprio YAML. Para sobrescrever, va em **Environment variables** e adicione somente as que deseja alterar.
5. Para deploy com dominio real, configure:
   - **APP_DOMAIN**: `https://woomed.consultio.com.br`
   - **ACME_EMAIL**: `admin@consultio.com.br`
6. **IMPORTANTE**: A stack usa a rede externa `woopanel1`. Crie-a antes se nao existir:
   ```bash
   docker network create woopanel1
   ```
7. Clique em **Deploy the stack**

#### 3.3 Configurar DNS

Crie um registro A apontando para o IP do servidor:
```
app.seudominio.com.br  A  <IP_DO_SERVIDOR>
```

O Caddy vai obter certificado SSL automaticamente via Let's Encrypt.

#### 3.4 Pos-deploy

- Apos o deploy, o Caddy pode levar 1-2 minutos para obter o certificado SSL
- Acompanhe os logs: va em **Stacks** > **consultio-med** > clica no servico > **Logs**

### Usando Webhook (deploy automatico)

No Portainer, ao criar a stack, ative "Webhook" e configure seu Git para enviar um POST para a URL do webhook a cada push. Assim o deploy e automatico.

## 4. Variaveis de Ambiente

### Sistema de Secrets (3 fontes)

O Consultio Med suporta 3 fontes para secrets, buscadas nesta ordem:

1. **Docker Secrets** — arquivos em `/run/secrets/<NOME>`
2. **File Secret** — arquivo customizado definido via `<NOME>_FILE`
3. **Environment Variable** — variável de ambiente `<NOME>`

Exemplo com Docker Secrets:
```yaml
secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  encryption_key:
    file: ./secrets/encryption_key.txt

services:
  consultio-med:
    secrets:
      - jwt_secret
      - encryption_key
```

Exemplo com File Secret:
```bash
export JWT_SECRET_FILE=/etc/secrets/jwt.txt
export ENCRYPTION_MASTER_KEY_FILE=/etc/secrets/encryption.key
```

### Rotação de Chaves (Zero Downtime)

Para rotacionar o JWT_SECRET sem invalidar sessoes ativas:

1. Defina a **nova chave** como `JWT_SECRET` (ou `JWT_SECRET_PRIMARY`)
2. Defina a **chave antiga** como `JWT_SECRET_SECONDARY`
3. Faça o deploy — tokens antigos ainda funcionam (via fallback)
4. Aguarde todos os tokens expirarem (24h)
5. Remova `JWT_SECRET_SECONDARY` no proximo deploy

### Obrigatorias

| Variavel | Descricao | Exemplo |
|---|---|---|
| `JWT_SECRET` | Chave para assinar tokens JWT (primaria) | `openssl rand -base64 32` |
| `JWT_SECRET_SECONDARY` | Chave secundaria (para rotacao zero-downtime) | `openssl rand -base64 32` |
| `ENCRYPTION_MASTER_KEY` | Chave mestra para criptografia AES-256-GCM | `openssl rand -hex 32` |
| `DB_PASSWORD` | Senha do PostgreSQL interno | `senha_forte_123` |
| `WHATSMEOW_WEBHOOK_SECRET` | Segredo do webhook WhatsApp | `openssl rand -hex 32` |

### Conexao com banco

**Opcao 1 - PostgreSQL interno (Docker):**
- O compose ja monta automaticamente com `DB_PASSWORD`
- `DATABASE_URL` e gerada automaticamente

**Opcao 2 - Supabase:**
- Obtenha a string em: Supabase > Settings > Database > Connection string
- Preencha `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc.
- Use `docker-compose.supabase.yml` se nao quiser PostgreSQL local

### Opcionais

| Variavel | Descricao | Default |
|---|---|---|
| `GEMINI_API_KEY` | Chave da API Gemini (Google AI Studio) | vazio (IA desligada) |
| `APP_URL` | URL publica da aplicacao | http://localhost:5173 |
| `PLATFORM_OWNER_EMAIL` | Email do dono da plataforma | owner@consultio.local |
| `WHATSMEOW_API_TOKEN` | Token de autenticacao do bridge | vazio (sem autenticacao) |
| `CORS_ORIGIN` | Origem permitida no CORS | true (tudo) |

## 5. Banco de Dados

### Estrutura

O Consultio Med usa duas camadas de banco:

1. **JSON file** (`data/consultio-data.json`): usada atualmente pelo runtime
2. **PostgreSQL**: parcialmente implementado via `server/database.ts`

### Migrations disponiveis

| Migration | Localizacao | Descricao |
|---|---|---|
| Runtime | `server/database.ts` | Tabelas basicas (auto-executada na inicializacao) |
| Supabase SaaS | `supabase/migrations/20260526190000_initial_saas_foundation.sql` | Schema completo com RLS, planos, multi-tenant |

### Backup

Backups sao feitos automaticamente a cada hora em `backups/`.
Para backups do PostgreSQL:

```bash
# Backup manual
docker compose exec postgres pg_dump -U consultio consultio > /tmp/backup-$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker compose exec -T postgres psql -U consultio consultio
```

## 6. WhatsApp Bridge

### Arquitetura

O bridge WhatsApp roda como servico separado em Go usando a biblioteca whatsmeow.
Ele se comunica com o Node.js via HTTP (webhooks) para mensagens recebidas.

### Fluxo de conexao

1. No painel do Consultio, va em "Conexoes WhatsApp"
2. Clique em "Nova Conexao", de um nome e informe o numero
3. Clique em "Conectar" - um QR Code aparecera
4. Escaneie com o WhatsApp do celular (Settings > Linked Devices)
5. Pronto! A sessao fica persistida mesmo apos restart do container

### Solucao de problemas

```bash
# Verificar se o bridge esta rodando
docker compose exec whatsmeow-bridge wget -qO- http://127.0.0.1:8080/health

# Ver logs do bridge
docker compose logs -f whatsmeow-bridge

# Resetar sessoes WhatsApp (cuidado: precisa parear de novo)
docker compose exec whatsmeow-bridge rm -rf /app/data/*.db
docker compose restart whatsmeow-bridge
```

### Container separado vs embutido

| Modo | Vantagem | Desvantagem |
|---|---|---|
| Container separado (recomendado) | Melhor isolamento, logs separados, restart independente | Um container a mais para gerenciar |
| Embutido (WHATSMEOW_API_URL vazio) | Simples, sem container extra | Bridge reinicia com o app, mais complexo de debug |

## 7. Manutencao

### Atualizar a aplicacao

```bash
# Local
git pull
docker compose up --build -d

# Portainer (com webhook)
# Configure o webhook no repositorio Git
```

### Logs centralizados

Todos os servicos usam `json-file` driver com rotacao de 10MB por arquivo,
mantendo 3 arquivos no maximo.

### Volumes persistentes

| Volume | Container | Descricao |
|---|---|---|
| `consultio_postgres_data` | postgres | Dados do banco |
| `consultio_med_data` | consultio-med | Dados JSON e config |
| `consultio_uploads` | consultio-med | Documentos enviados |
| `consultio_whatsmeow_data` | whatsmeow-bridge | Sessoes WhatsApp |
| `consultio_caddy_data` | caddy | Certificados SSL |

### Comandos de emergencia

```bash
# Resetar tudo (cuidado: PERDE DADOS!)
docker compose down -v && docker compose up --build -d

# Acessar o banco via psql
docker compose exec postgres psql -U consultio consultio

# Verificar saude de todos os servicos
docker compose ps
```

## 8. Troubleshooting

### Caddy nao obtem certificado SSL
- Verifique se o DNS esta apontando para o servidor
- Verifique se as portas 80 e 443 estao liberadas no firewall
- Acompanhe os logs: `docker compose logs caddy`

### consultio-med reinicia em loop
```bash
docker compose logs consultio-med | tail -50
```
Causas comuns:
- `JWT_SECRET` ou `ENCRYPTION_MASTER_KEY` nao configurados
- `DATABASE_URL` invalida ou banco inacessivel
- Porta 5173 ja em uso

### WhatsApp nao conecta
- Verifique se o bridge esta saudavel: `curl http://localhost:8080/health`
- Verifique os logs: `docker compose logs whatsmeow-bridge`
- O webhook precisa alcancar o consultio-med: `APP_WEBHOOK_URL=http://consultio-med:5173/api/whatsapp/webhook`

### Erro de permissao em volumes (Linux)
```bash
# O Node.js container roda como node user (UID 1000)
# O PostgreSQL container roda como postgres user (UID 999)
# Se houver erro de permissao, ajuste:
sudo chown -R 1000:1000 data/
sudo chown -R 999:999 postgres_data/
```

# Portainer Stack

Use `deploy/portainer-stack.yml` para subir o Consultio Med no Portainer.

## Pre-requisitos

- DNS do dominio apontando para o IP do servidor.
- Portas `80`, `443/tcp` e `443/udp` livres no servidor.
- Stack criada pelo modo Git do Portainer, ou imagem `consultio-med:latest` ja disponivel no host.

## Variaveis da stack

Copie `deploy/portainer.env.example` para o campo de variaveis do Portainer e preencha:

- `APP_DOMAIN`: dominio completo com `https://`, exemplo `https://app.seudominio.com.br`
- `APP_URL`: igual ao dominio publico
- `ACME_EMAIL`: email usado pelo Caddy/Let's Encrypt
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_ANON_KEY`: chave anon do Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: somente se o backend precisar executar operacoes administrativas
- `SUPABASE_DB_URL`: somente se workers/migrations forem aplicados pelo container
- `VITE_SUPABASE_URL`: mesma URL do Supabase para build/frontend
- `VITE_SUPABASE_ANON_KEY`: mesma anon key para build/frontend
- `PLATFORM_OWNER_EMAIL`: email do dono inicial da plataforma
- `WHATSMEOW_API_URL`: URL interna do bridge Whatsmeow quando ele for adicionado
- `WHATSMEOW_API_TOKEN`: token do bridge Whatsmeow, se habilitado
- `WHATSMEOW_WEBHOOK_SECRET`: segredo usado pelo webhook Whatsmeow

## Observacoes

Esta stack usa Caddy como proxy HTTPS automatico e faz proxy de WebSocket sem configuracao extra. Se o servidor ja tiver Traefik, Nginx Proxy Manager ou outro proxy usando as portas 80/443, remova o servico `proxy` e publique apenas a porta interna `5173` para o proxy existente.

# Project Lifecycle & Permanent Technical Memory — Velox Automator

> **Document Status**: Active / Permanent Technical Memory
> **Generated Date**: 2026-07-30
> **Total Analyzed Commits**: 71
> **Repository Commit Range**: `138879d` → `50ad027`

## 1. Overview

**Fact:** O **Velox Automator** é um sistema SaaS Multi-Tenant projetado para automatizar a captura, validação e aceite em tempo real de chamados e convites de assistência veicular (guincho, socorro mecânico) recebidos através de mensagens no WhatsApp. O sistema conecta uma frota de robôs headless desacoplados (baseados em Puppeteer e `whatsapp-web.js`) a um painel de controle Next.js integrado ao Supabase (Auth, PostgreSQL e Realtime RLS).

**Inference:** O projeto evoluiu através de 71 commits de um protótipo de script único Node.js em arquivo local para uma arquitetura Monorepo robusta (com Turborepo), resiliente a reinicializações de servidores Linux ARM64 (Oracle Ampere), com suporte a código de pareamento numérico de 8 dígitos do WhatsApp (substituindo QR code quando necessário), sistema anti-zumbi e deduplicação de chamados.

## 2. Project Origin

**Fact:** O projeto iniciou no commit [`138879d`](file:///c:/Users/Lucas/Desktop/amazing-planck/index.js) (`138879d`), em 24/07/2026. Inicialmente, continha apenas um script `index.js` simples que executava o cliente `whatsapp-web.js`, exibia o QR code no terminal e utilizava o Puppeteer para navegar diretamente até URLs contendo domínios da Velox (`http://velox...`).

## 3. Technology Stack

**Fact:** A stack técnica oficial do projeto é composta por:

- **Arquitetura de Repositório**: Monorepo gerenciado por Turborepo e `npm workspaces` (`apps/web`, `apps/worker`, `packages/database`, `packages/types`).
- **Frontend Web**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React icons, Glassmorphism UI tokens.
- **Worker & Automação**: Node.js, TypeScript, `whatsapp-web.js` (com injeção de rotinas para pareamento via código de telefone), Puppeteer Headless Client.
- **Banco de Dados & Autenticação**: Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS) habilitado com isolamento multi-tenant por `tenant_id` e automações `pg_cron`.
- **Gerenciamento de Processos & Infraestrutura**: PM2 (`ecosystem.config.js` com fuso horário `America/Sao_Paulo`), hospedagem frontend na Vercel e worker em instâncias Linux ARM64 (Oracle Cloud Ampere).

## 4. Repository Structure

```text
amazing-planck/
├── apps/
│   ├── web/                         # Frontend Next.js 14 App Router
│   │   ├── app/                     # Rotas e Páginas (page.tsx, layout.tsx, login/page.tsx)
│   │   ├── components/              # Componentes de UI (CallsFeed.tsx, QRModal.tsx, FleetManagement.tsx)
│   │   └── lib/                     # Cliente Supabase (supabase.ts)
│   └── worker/                      # Orquestrador de Automação Headless
│       ├── src/
│       │   ├── index.ts             # Loop do Orquestrador, gerenciamento de sessoes, boot concorrente
│       │   ├── whatsapp.ts          # Classe WhatsAppWorker (QR code, pairing code, heartbeat anti-zumbi)
│       │   └── scraper.ts           # VeloxScraper (automacao de aceite no Puppeteer, retry)
│       └── tsconfig.json
├── packages/
│   ├── database/                    # Pacote compartilhado Supabase SDK & Cron SQL
│   │   ├── src/index.ts
│   │   └── cron_auto_complete.sql
│   └── types/                       # Tipos compartilhados em TypeScript (TenantSession, CallItem, FleetVehicle)
│       └── src/index.ts
├── ecosystem.config.js              # Configuração de processos PM2 (fuso SP, envs Snap)
├── schema.sql                       # DDL completo das tabelas, RLS e triggers Supabase
├── cron_auto_complete.sql           # SQL para agendamento pg_cron
├── package.json                     # Monorepo root package.json
└── tsconfig.json                    # Root TypeScript config
```

## 5. Complete Git Timeline

| # | Data | Commit | Mensagem | Autor |
| - | ---- | ------ | -------- | ----- |
| 1 | Tue Jul 21 17:32 | `138879d` | Initial commit | mlc4ca |
| 2 | Thu Jul 23 22:21 | `84d114f` | feat: migracao para TypeScript, estrutura Monorepo e integracao Supabase SaaS | MachareteL |
| 3 | Thu Jul 23 22:30 | `9bee6a2` | feat: implementacao de Supabase Auth, RLS Multi-Tenant e Orquestrador de Workers | MachareteL |
| 4 | Thu Jul 23 22:34 | `0cf4c3d` | fix: remover cadastro publico e manter apenas login restrito para prestadores | MachareteL |
| 5 | Thu Jul 23 22:38 | `eaa2fcf` | fix: adicionar restricao UNIQUE em tenant_id e upsert seguro no QRModal e Orquestrador | MachareteL |
| 6 | Thu Jul 23 22:41 | `b232393` | fix: atualizar RLS no Supabase para permitir que o Worker acesse e atualize as sessoes em tempo real | MachareteL |
| 7 | Thu Jul 23 22:50 | `ebf99db` | docs: adicionar arquivo de script SQL completo e politicas RLS em schema.sql | MachareteL |
| 8 | Thu Jul 23 22:53 | `43e0fff` | style: atualizar branding para Velox Automator e simplificar termos da UI | MachareteL |
| 9 | Fri Jul 24 14:10 | `259ca57` | feat: adicionar chave ON/OFF para ativar/pausar aceites automaticos pelo prestador | MachareteL |
| 10 | Fri Jul 24 16:14 | `4790332` | feat: implementacao de reconexao segura Anti-Ban (Exponential Backoff) e Retry inteligente no VeloxScraper | MachareteL |
| 11 | Fri Jul 24 20:43 | `d13521d` | feat: implementacao de Gestao de Frota simplificada, relatorio por veiculo e controle de atendimentos simultaneos | MachareteL |
| 12 | Fri Jul 24 21:50 | `34af96b` | style: redesenhar interface UX/UI do Velox Automator para padrao glassmorphism moderno, responsivo e intuitivo | MachareteL |
| 13 | Sat Jul 25 12:22 | `5a51317` | feat(worker): add PUPPETEER_EXECUTABLE_PATH support for ARM64/Linux | MachareteL |
| 14 | Sat Jul 25 13:11 | `514a59f` | fix(vercel): build monorepo dependencies before next build and remove static fallback keys | MachareteL |
| 15 | Sat Jul 25 13:12 | `474f975` | fix(database): allow safe placeholder initialization during Next.js SSG build | MachareteL |
| 16 | Sat Jul 25 13:14 | `ba8bf31` | fix(database): add @types/node devDependency to resolve process global | MachareteL |
| 17 | Sat Jul 25 13:29 | `5060981` | fix(orchestrator): stop worker when tenant/session is deleted from database | MachareteL |
| 18 | Sat Jul 25 21:39 | `c7fd219` | feat(scraper): add comprehensive diagnostic logging, multi-strategy form extraction and frontend debug inspector | MachareteL |
| 19 | Sat Jul 25 21:46 | `ccd3d86` | fix(scraper): remove mandatory IdAtendimentoConvite requirement which blocked valid Velox invites | MachareteL |
| 20 | Sun Jul 26 16:31 | `0b903e8` | feat: add PM2 log timestamps and update close distance preview to 50min | MachareteL |
| 21 | Sun Jul 26 16:34 | `83b74a3` | fix(database): add missing RLS UPDATE policy for captured_calls and use maybeSingle in completeCapturedCall | MachareteL |
| 22 | Mon Jul 27 11:32 | `472c123` | feat(logging): add structured step-by-step console logs with timing for GET, Parsing, and POST requests | MachareteL |
| 23 | Mon Jul 27 13:01 | `fdb3530` | fix(ui): melhora feedback ao gerar QR Code e ajusta responsividade do header no mobile | MachareteL |
| 24 | Mon Jul 27 13:05 | `429a257` | feat: add 300ms delay when retrying | MachareteL |
| 25 | Mon Jul 27 14:18 | `69ee54c` | feat(whatsapp): add phone number pairing code (8-digit) authentication flow | MachareteL |
| 26 | Mon Jul 27 14:28 | `6453372` | fix(whatsapp): handle on-demand pairing code generation for existing active workers | MachareteL |
| 27 | Mon Jul 27 14:32 | `54d6c8a` | fix(web): resolve React Error #310 by moving early return after all hook declarations | MachareteL |
| 28 | Mon Jul 27 14:35 | `e3a2e8f` | build: make build:worker automatically compile types and database packages | MachareteL |
| 29 | Mon Jul 27 14:43 | `8fc9ae0` | fix(worker): handle Chromium CDP context navigation rejections gracefully | MachareteL |
| 30 | Mon Jul 27 14:45 | `284ea3f` | fix(web): add session reset action and prevent loading state lock in QRModal | MachareteL |
| 31 | Mon Jul 27 14:54 | `04177d2` | fix(orchestrator): prevent killing active worker instances on transient disconnects to preserve background auto-reconnection | MachareteL |
| 32 | Mon Jul 27 15:02 | `68a7b19` | feat(ux): add intermediate AUTHENTICATING state and smooth transition modal on mobile auth success | MachareteL |
| 33 | Mon Jul 27 15:03 | `aaf38d2` | fix(worker): fix try-catch syntax error in whatsapp.ts qr event | MachareteL |
| 34 | Mon Jul 27 15:05 | `8c8c87c` | fix(security): implement QR refresh rate limits and selective boot to protect VM resources and prevent IP ban | MachareteL |
| 35 | Mon Jul 27 15:06 | `a5f725f` | fix(copy): update connection modal loading text to 'Inicializando robô de automação' for privacy | MachareteL |
| 36 | Mon Jul 27 15:42 | `e5ff6a3` | fix(web): prevent premature loading state while typing phone number in QRModal | MachareteL |
| 37 | Mon Jul 27 16:08 | `140db31` | fix(worker): purge stopped worker instances on re-auth and auto-recover from detached Chromium frames | MachareteL |
| 38 | Mon Jul 27 16:12 | `616c156` | perf(orchestrator): add 800ms boot stagger between tenant sessions to smooth out CPU spikes on restart | MachareteL |
| 39 | Mon Jul 27 19:14 | `e1733d0` | fix(worker): add DOM stabilization delay and phone format fallback for pairing code request | MachareteL |
| 40 | Mon Jul 27 19:17 | `5c932a1` | fix(worker): add waitForStorePairingCode to ensure WhatsApp Web JS bundle is ready before calling requestPairingCode | MachareteL |
| 41 | Mon Jul 27 19:30 | `4c74485` | fix(worker): implement progressive retry loop for pairing code generation against Webpack module injection delays | MachareteL |
| 42 | Mon Jul 27 19:35 | `b97ac20` | fix(worker): add triggerPairingCodeUI to force Webpack injection of PairingCodeLinkUtils and simulate canvas button click | MachareteL |
| 43 | Mon Jul 27 19:40 | `0971002` | fix(worker): evaluate DOM directly via pupPage.evaluate for pairing code generation to prevent undefined method errors | MachareteL |
| 44 | Mon Jul 27 19:47 | `dd8387f` | fix(worker): restore clean native client.requestPairingCode with 2s stabilization retry loop | MachareteL |
| 45 | Mon Jul 27 20:07 | `f768b12` | fix(worker): automatically test both national (11-digit) and international (13-digit) phone formats for pairing code generation | MachareteL |
| 46 | Mon Jul 27 20:10 | `6cd0691` | fix(anti-ban): cap max pairing code retries to 3 per format with 2s cooldown for IP reputation protection | MachareteL |
| 47 | Mon Jul 27 20:13 | `9afb450` | fix(worker): purge stale/corrupted IndexedDB cache files for unauthenticated tenants to fix invariant #56367 | MachareteL |
| 48 | Mon Jul 27 20:31 | `adb5ab7` | fix: implement WhatsApp worker class with session management and pairing code support | MachareteL |
| 49 | Mon Jul 27 21:05 | `055854c` | backup: versao estavel da autenticacao whatsapp com expurgo de sessao e pareamento por telefone sob demanda | MachareteL |
| 50 | Tue Jul 28 10:38 | `e32f624` | fix(worker): prevent destroying active workers, listen to message and message_create with deduplication, and protect session directories | MachareteL |
| 51 | Tue Jul 28 10:38 | `a8afe3b` | fix(worker): import fs module in index.ts for clean compilation | MachareteL |
| 52 | Tue Jul 28 11:22 | `6ca689e` | fix(logs): silence group/status messages and enforce strict 8/8 cap for unauthenticated QR loops | MachareteL |
| 53 | Wed Jul 29 10:12 | `1808578` | fix(scraper): prioritize form input extraction over full page body text checks to prevent false positive non-retryable errors | MachareteL |
| 54 | Wed Jul 29 10:19 | `6419126` | fix(scraper): eliminate false positive success reports by strictly validating GET and POST response bodies for 'already accepted' messages | MachareteL |
| 55 | Wed Jul 29 10:24 | `d8ab404` | fix(logging): print exact error message, page title, and HTML snippet when scraper cancels without retry | MachareteL |
| 56 | Wed Jul 29 12:43 | `c5fe6c3` | feat(web): mover botao de acoes para a primeira coluna no feed de chamados | MachareteL |
| 57 | Wed Jul 29 13:32 | `d390a81` | feat(worker): add duplicate call detection based on ChaveConvite to prevent extra vehicle capacity consumption | MachareteL |
| 58 | Wed Jul 29 16:38 | `7c6a6ac` | feat(worker): adicionar health check heartbeat anti-zumbi e deduplicação por ChaveConvite | MachareteL |
| 59 | Wed Jul 29 17:17 | `12eeffb` | fix(worker): limpar arquivos de trava SingletonLock ao reiniciar navegador zumbi | MachareteL |
| 60 | Wed Jul 29 17:28 | `c23c763` | feat(worker): auto-detectar executavel do Chromium no Linux ARM64 (Oracle Ampere) | MachareteL |
| 61 | Wed Jul 29 18:16 | `680d4fd` | feat(database): adicionar script SQL cron_auto_complete.sql para finalização automatica via pg_cron | MachareteL |
| 62 | Wed Jul 29 18:25 | `d7519e4` | chore(database): atualizar intervalo do cron_auto_complete para 5 minutos | MachareteL |
| 63 | Wed Jul 29 18:26 | `a2c89e7` | config(pm2): adicionar fuso horario TZ America/Sao_Paulo no ecosystem.config.js | MachareteL |
| 64 | Wed Jul 29 22:05 | `1dda24c` | fix(pm2): adicionar SYSTEMD_IGNORE_CHROOT e DBUS_SESSION_BUS_ADDRESS para liberar Snap Chromium no PM2 | MachareteL |
| 65 | Thu Jul 30 09:50 | `3424c85` | fix(worker): adicionar loop de auto-recuperacao/retry ao falhar abertura do Chromium e repassar envs no Puppeteer | MachareteL |
| 66 | Thu Jul 30 10:22 | `e1b82b4` | fix(worker): filtrar e rejeitar executaveis do Chromium vinculados ao Snap no Linux | MachareteL |
| 67 | Thu Jul 30 10:26 | `ea0628d` | fix(worker): validar e desconsiderar PUPPETEER_EXECUTABLE_PATH inexistente ou vinculado ao Snap | MachareteL |
| 68 | Thu Jul 30 10:28 | `82a2122` | fix(worker): detectar e ignorar scripts de atalho do Ubuntu Snap stub em /usr/bin/chromium-browser | MachareteL |
| 69 | Thu Jul 30 10:33 | `75e2546` | perf(orchestrator): tornar a inicializacao de sessoes concorrente no boot sem bloquear o loop principal | MachareteL |
| 70 | Thu Jul 30 10:34 | `3faa000` | fix(worker): aumentar protocolTimeout do Puppeteer para 180s evitando timeout em leituras de IndexedDB no ARM64 | MachareteL |
| 71 | Thu Jul 30 10:36 | `50ad027` | fix(worker): remover webVersionCache remota que travava inicializacao do WhatsApp Web no boot | MachareteL |

## 6. Development Phases

1. **FASE 1 — Bootstrap & Arquitetura Monorepo (Commits 1 a 4)**: Criação do protótipo, conversão para Monorepo com Turborepo (`apps/web`, `apps/worker`, `packages/database`, `packages/types`), Supabase Auth e login restrito para prestadores.
2. **FASE 2 — Modelagem de Dados & Supabase RLS (Commits 5 a 7)**: Adição de chave UNIQUE em `tenant_id`, autorizações de UPDATE em tempo real para workers no Supabase RLS e criação do arquivo `schema.sql`.
3. **FASE 3 — Controles de Operação & Resiliência (Commits 8 a 10)**: Rebranding Velox Automator, chave ON/OFF para controle de aceites automáticos e retry com Exponential Backoff no scraper.
4. **FASE 4 — Gestão de Frota & Redesign UI (Commits 11 a 12)**: Gestão de capacidade de frota por veículo (`fleet_vehicles`) e interface moderna em Glassmorphism responsivo.
5. **FASE 5 — Suporte Linux ARM64 & Ajustes de Build (Commits 13 a 17)**: Detecção de Chromium no Linux ARM64, pipeline Vercel e encerramento automático de workers de tenants excluídos.
6. **FASE 6 — Diagnóstico de Scraper & Autenticação via Telefone (Commits 18 a 27)**: Logs detalhados, fluxo de Pairing Code de 8 dígitos do WhatsApp Web e fix do React Hook Error #310.
7. **FASE 7 — Resiliência CDP & Limpeza de Recursos (Commits 28 a 38)**: Tratamento de exceções CDP no Chromium, rate limit de QR codes, transições de estado na UI e inicialização escalonada (stagger 800ms).
8. **FASE 8 — Estabilização de Pareamento & Purga de Cache (Commits 39 a 48)**: Injeções DOM/Webpack no WhatsApp Web, purga de IndexedDB corrompido (#56367), cooldown anti-ban e classe `WhatsAppWorker`.
9. **FASE 9 — Deduplicação & Validação Estrita de Scraper (Commits 49 a 56)**: Deduplicação de eventos de mensagem, silenciamento de logs irrelevantes e validação rigorosa de HTML de resposta no aceite.
10. **FASE 10 — Heartbeat Anti-Zumbi & Automação Cron (Commits 57 a 64)**: Deduplicação por `ChaveConvite`, verificação de saúde anti-zumbi, limpeza de `SingletonLock`, script `cron_auto_complete.sql` e ajustes no PM2.
11. **FASE 11 — Compatibilidade Linux Snap/ARM64 & Concorrência (Commits 65 a 71)**: Ignorar executáveis do Ubuntu Snap stub em `/usr/bin/chromium-browser`, boot de sessões concorrente sem bloqueio do loop, aumento do `protocolTimeout` do Puppeteer para 180s e remoção de trava no `webVersionCache`.

## 7. Commit-by-Commit Analysis

### Commit 1: `138879d` — Initial commit

- **Hash Completo**: `138879d607b441280f770a9a039b92c770783d71`
- **Data**: Tue Jul 21 17:32:27 2026 -0300
- **Autor**: mlc4ca
- **Mensagem**: `Initial commit`
- **Resumo das Alterações (git stat)**:
```text
138879d Initial commit
```
- **Fact**: O commit `138879d` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Tue Jul 21 17:32.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 138879d607b441280f770a9a039b92c770783d71
Author: mlc4ca <mlc4ca@bosch.com>
Date:   Tue Jul 21 17:32:27 2026 -0300

    Initial commit
```

### Commit 2: `84d114f` — feat: migracao para TypeScript, estrutura Monorepo e integracao Supabase SaaS

- **Hash Completo**: `84d114f2fce82cb18619a89e0959f15e1b4003b3`
- **Data**: Thu Jul 23 22:21:01 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat: migracao para TypeScript, estrutura Monorepo e integracao Supabase SaaS`
- **Resumo das Alterações (git stat)**:
```text
84d114f feat: migracao para TypeScript, estrutura Monorepo e integracao Supabase SaaS
 .env.example                            |    3 +
 .gitignore                              |   31 +
 README.md                               |   33 +
 apps/web/app/globals.css                |   21 +
 apps/web/app/layout.tsx                 |   17 +
 apps/web/app/page.tsx                   |  140 +
 apps/web/components/CallsFeed.tsx       |  114 +
 apps/web/components/MetricsCards.tsx    |   83 +
 apps/web/components/Navbar.tsx          |   77 +
 apps/web/components/QRModal.tsx         |  103 +
 apps/web/components/SystemLogViewer.tsx |   51 +
 apps/web/lib/supabase.ts                |   10 +
 apps/web/next-env.d.ts                  |    5 +
 apps/web/package.json                   |   29 +
 apps/web/postcss.config.js              |    6 +
 apps/web/tailwind.config.js             |   26 +
 apps/web/tsconfig.json                  |   27 +
 apps/worker/package.json                |   27 +
 apps/worker/src/calculator.ts           |   18 +
 apps/worker/src/index.ts                |   76 +
 apps/worker/src/scraper.ts              |  137 +
 apps/worker/src/whatsapp.ts             |  182 +
 apps/worker/tsconfig.json               |   10 +
 ecosystem.config.js                     |   22 +
 index.js                                |  152 +
 package-lock.json                       | 5644 +++++++++++++++++++++++++++++++
 package.json                            |   25 +
 packages/database/package.json          |   17 +
 packages/database/src/index.ts          |  100 +
 packages/database/tsconfig.json         |    8 +
 packages/types/package.json             |   13 +
 packages/types/src/index.d.ts           |   67 +
 packages/types/src/index.d.ts.map       |    1 +
 packages/types/src/index.js             |    3 +
 packages/types/src/index.js.map         |    1 +
 packages/types/src/index.ts             |   79 +
 packages/types/tsconfig.json            |    8 +
 tsconfig.json                           |   14 +
 38 files changed, 7380 insertions(+)
```
- **Fact**: O commit `84d114f` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 23 22:21.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 84d114f2fce82cb18619a89e0959f15e1b4003b3
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 23 22:21:01 2026 -0300

    feat: migracao para TypeScript, estrutura Monorepo e integracao Supabase SaaS

diff --git a/.env.example b/.env.example
new file mode 100644
index 0000000..17d5fbe
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,3 @@
+# Padrão Regex para captura da URL de convite no WhatsApp
+TARGET_REGEX=https:\/\/prestador\.veloxcontactcenter\.com\.br\/prestador\/ConvitePrestador\/VisualizarConvite\?ChaveConvite=[a-f0-9\-]+
+HTTP_TIMEOUT=5000
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000..071204d
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,31 @@
+# Node modules
+node_modules/
+**/node_modules/
+
+# Next.js build output
+.next/
+**/apps/web/.next/
+dist/
+**/dist/
+
+# WhatsApp Web JS auth & cache
+.wwebjs_auth/
+.wwebjs_cache/
+
+# Environment variables
+.env
+.env.local
+.env.development.local
+.env.production.local
+
+# Logs
+*.log
+npm-debug.log*
+yarn-debug.log*
+yarn-error.log*
+
+# OS / Editor files
+.DS_Store
+Thumbs.db
+.vscode/
+.idea/
diff --git a/README.md b/README.md
new file mode 100644
index 0000000..ea83c70
--- /dev/null
+++ b
```

### Commit 3: `9bee6a2` — feat: implementacao de Supabase Auth, RLS Multi-Tenant e Orquestrador de Workers

- **Hash Completo**: `9bee6a2bdc399a749bd4e62c4483835818627bc2`
- **Data**: Thu Jul 23 22:30:47 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat: implementacao de Supabase Auth, RLS Multi-Tenant e Orquestrador de Workers`
- **Resumo das Alterações (git stat)**:
```text
9bee6a2 feat: implementacao de Supabase Auth, RLS Multi-Tenant e Orquestrador de Workers
 apps/web/app/layout.tsx         |   3 +-
 apps/web/app/login/page.tsx     | 198 ++++++++++++++++++++++++++++++++++++++++
 apps/web/app/page.tsx           |  63 ++++++++++---
 apps/web/components/Navbar.tsx  |  24 ++++-
 apps/web/components/QRModal.tsx |  10 +-
 apps/web/lib/auth-context.tsx   |  67 ++++++++++++++
 apps/worker/src/index.ts        |  84 ++++++++++-------
 7 files changed, 395 insertions(+), 54 deletions(-)
```
- **Fact**: O commit `9bee6a2` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 23 22:30.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 9bee6a2bdc399a749bd4e62c4483835818627bc2
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 23 22:30:47 2026 -0300

    feat: implementacao de Supabase Auth, RLS Multi-Tenant e Orquestrador de Workers

diff --git a/apps/web/app/layout.tsx b/apps/web/app/layout.tsx
index e86c3c2..66f9e8c 100644
--- a/apps/web/app/layout.tsx
+++ b/apps/web/app/layout.tsx
@@ -1,5 +1,6 @@
 import './globals.css';
 import React from 'react';
+import { AuthProvider } from '../lib/auth-context';
 
 export const metadata = {
   title: 'Velox WhatsApp SaaS Automator',
@@ -10,7 +11,7 @@ export default function RootLayout({ children }: { children: React.ReactNode })
   return (
     <html lang="pt-BR">
       <body className="bg-gray-950 text-gray-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-black">
-        {children}
+        <AuthProvider>{children}</AuthProvider>
       </body>
     </html>
   );
diff --git a/apps/web/app/login/page.tsx b/apps/web/app/login/page.tsx
new file mode 100644
index 0000000..fd3fbf3
--- /dev/null
+++ b/apps/web/app/login/page.tsx
@@ -0,0 +1,198 @@
+'use client';
+
+import React, { useState } from 'react';
+import { useRouter } from 'next
```

### Commit 4: `0cf4c3d` — fix: remover cadastro publico e manter apenas login restrito para prestadores

- **Hash Completo**: `0cf4c3d5c1899dffe2035dabf4aec21eb4674f67`
- **Data**: Thu Jul 23 22:34:00 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix: remover cadastro publico e manter apenas login restrito para prestadores`
- **Resumo das Alterações (git stat)**:
```text
0cf4c3d fix: remover cadastro publico e manter apenas login restrito para prestadores
 apps/web/app/login/page.tsx | 130 ++++++++------------------------------------
 package.json                |   4 ++
 2 files changed, 28 insertions(+), 106 deletions(-)
```
- **Fact**: O commit `0cf4c3d` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 23 22:34.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 0cf4c3d5c1899dffe2035dabf4aec21eb4674f67
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 23 22:34:00 2026 -0300

    fix: remover cadastro publico e manter apenas login restrito para prestadores

diff --git a/apps/web/app/login/page.tsx b/apps/web/app/login/page.tsx
index fd3fbf3..692ff50 100644
--- a/apps/web/app/login/page.tsx
+++ b/apps/web/app/login/page.tsx
@@ -2,64 +2,37 @@
 
 import React, { useState } from 'react';
 import { useRouter } from 'next/navigation';
-import { Activity, Lock, Mail, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';
+import { Activity, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
 import { supabase } from '../../lib/supabase';
 
 export default function LoginPage() {
   const router = useRouter();
-  const [isSignUp, setIsSignUp] = useState(false);
 
-  const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
-  const [accessCode, setAccessCode] = useState('');
 
   const [loading, setLoading] = useState(false);
   const [errorMsg, setErrorMsg] = useState<string | null>(null);
-  const [successMsg, setSuccessMsg] = useState<stri
```

### Commit 5: `eaa2fcf` — fix: adicionar restricao UNIQUE em tenant_id e upsert seguro no QRModal e Orquestrador

- **Hash Completo**: `eaa2fcf77d51bf197642c5c5e1bbbda2d9880687`
- **Data**: Thu Jul 23 22:38:48 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix: adicionar restricao UNIQUE em tenant_id e upsert seguro no QRModal e Orquestrador`
- **Resumo das Alterações (git stat)**:
```text
eaa2fcf fix: adicionar restricao UNIQUE em tenant_id e upsert seguro no QRModal e Orquestrador
 apps/web/app/page.tsx           | 37 +++++++++++++++++++++++++++----------
 apps/web/components/QRModal.tsx | 41 ++++++++++++++++++++++++++++++++---------
 apps/worker/src/index.ts        | 14 ++++++++++----
 3 files changed, 69 insertions(+), 23 deletions(-)
```
- **Fact**: O commit `eaa2fcf` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 23 22:38.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit eaa2fcf77d51bf197642c5c5e1bbbda2d9880687
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 23 22:38:48 2026 -0300

    fix: adicionar restricao UNIQUE em tenant_id e upsert seguro no QRModal e Orquestrador

diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx
index 0068ff5..2c027c9 100644
--- a/apps/web/app/page.tsx
+++ b/apps/web/app/page.tsx
@@ -33,35 +33,47 @@ export default function DashboardPage() {
     if (!user) return;
     const tenantId = user.id;
 
-    // 1. Carrega o estado inicial da sessão do WhatsApp do Prestador Autenticado
+    console.log(`[Dashboard] Carregando dados para o prestador [tenant_id: ${tenantId}]`);
+
+    // 1. Carrega o estado inicial da sessão do WhatsApp
     const fetchInitialSession = async () => {
-      const { data } = await supabase
+      const { data, error } = await supabase
         .from('whatsapp_sessions')
         .select('*')
         .eq('tenant_id', tenantId)
-        .single();
+        .maybeSingle();
+
+      if (error) {
+        console.error('[Dashboard] Erro ao buscar whatsapp_sessions:', error);
+      }
 
       if (data) {
+        console.log('[Dashboard] Sessão inicial carregada:', data);
```

### Commit 6: `b232393` — fix: atualizar RLS no Supabase para permitir que o Worker acesse e atualize as sessoes em tempo real

- **Hash Completo**: `b232393dab64bd9c6ec5d1a44e78296ed6d5590f`
- **Data**: Thu Jul 23 22:41:47 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix: atualizar RLS no Supabase para permitir que o Worker acesse e atualize as sessoes em tempo real`
- **Resumo das Alterações (git stat)**:
```text
b232393 fix: atualizar RLS no Supabase para permitir que o Worker acesse e atualize as sessoes em tempo real
 packages/database/src/index.ts | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)
```
- **Fact**: O commit `b232393` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 23 22:41.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit b232393dab64bd9c6ec5d1a44e78296ed6d5590f
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 23 22:41:47 2026 -0300

    fix: atualizar RLS no Supabase para permitir que o Worker acesse e atualize as sessoes em tempo real

diff --git a/packages/database/src/index.ts b/packages/database/src/index.ts
index a53549c..ef9c5d5 100644
--- a/packages/database/src/index.ts
+++ b/packages/database/src/index.ts
@@ -25,7 +25,7 @@ export function createSupabaseClient(
 
 export async function updateSessionStatus(
   supabase: SupabaseClient,
-  sessionId: string,
+  sessionIdOrTenantId: string,
   status: WhatsAppSessionStatus,
   qrCode?: string | null,
   workerId?: string | null
@@ -45,9 +45,9 @@ export async function updateSessionStatus(
   const { data, error } = await supabase
     .from('whatsapp_sessions')
     .update(updateData)
-    .eq('id', sessionId)
+    .or(`id.eq.${sessionIdOrTenantId},tenant_id.eq.${sessionIdOrTenantId}`)
     .select('*')
-    .single();
+    .maybeSingle();
 
   if (error) {
     console.error('Erro ao atualizar whatsapp_session:', error.message);
```

### Commit 7: `ebf99db` — docs: adicionar arquivo de script SQL completo e politicas RLS em schema.sql

- **Hash Completo**: `ebf99dbacf6af0e6cf4e6f74eee239a4b6553f13`
- **Data**: Thu Jul 23 22:50:19 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `docs: adicionar arquivo de script SQL completo e politicas RLS em schema.sql`
- **Resumo das Alterações (git stat)**:
```text
ebf99db docs: adicionar arquivo de script SQL completo e politicas RLS em schema.sql
 packages/database/schema.sql | 152 +++++++++++++++++++++++++++++++++++++++++++
 schema.sql                   | 152 +++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 304 insertions(+)
```
- **Fact**: O commit `ebf99db` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 23 22:50.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit ebf99dbacf6af0e6cf4e6f74eee239a4b6553f13
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 23 22:50:19 2026 -0300

    docs: adicionar arquivo de script SQL completo e politicas RLS em schema.sql

diff --git a/packages/database/schema.sql b/packages/database/schema.sql
new file mode 100644
index 0000000..58c5c87
--- /dev/null
+++ b/packages/database/schema.sql
@@ -0,0 +1,152 @@
+-- ==============================================================================
+-- SCHEMA COMPLETO E DEFINIÇÃO DE SEGURANÇA RLS (SUPABASE / POSTGRESQL)
+-- Projeto: Velox WhatsApp SaaS Automator
+-- ==============================================================================
+
+-- 1. TABELAS DO SISTEMA
+-- ------------------------------------------------------------------------------
+
+-- Tabela de Tenants (Prestadores Autônomos / Empresas)
+CREATE TABLE IF NOT EXISTS public.tenants (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    name TEXT NOT NULL,
+    email TEXT UNIQUE NOT NULL,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
+);
+
+-- Tabela de Sessões do WhatsApp por Prestador
+CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
+    id UUID PRIMARY KEY DEFAULT
```

### Commit 8: `43e0fff` — style: atualizar branding para Velox Automator e simplificar termos da UI

- **Hash Completo**: `43e0fff9846074240e029877961ad7c3bead71ad`
- **Data**: Thu Jul 23 22:53:03 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `style: atualizar branding para Velox Automator e simplificar termos da UI`
- **Resumo das Alterações (git stat)**:
```text
43e0fff style: atualizar branding para Velox Automator e simplificar termos da UI
 apps/web/app/layout.tsx                 |  4 ++--
 apps/web/app/login/page.tsx             | 11 +++++------
 apps/web/components/CallsFeed.tsx       | 22 ++++++++++-----------
 apps/web/components/MetricsCards.tsx    | 20 +++++++++----------
 apps/web/components/Navbar.tsx          | 12 +++++------
 apps/web/components/QRModal.tsx         | 24 +++++++++-------------
 apps/web/components/SystemLogViewer.tsx | 35 ++++++++++++++++++++++++---------
 7 files changed, 69 insertions(+), 59 deletions(-)
```
- **Fact**: O commit `43e0fff` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 23 22:53.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 43e0fff9846074240e029877961ad7c3bead71ad
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 23 22:53:03 2026 -0300

    style: atualizar branding para Velox Automator e simplificar termos da UI

diff --git a/apps/web/app/layout.tsx b/apps/web/app/layout.tsx
index 66f9e8c..54dd956 100644
--- a/apps/web/app/layout.tsx
+++ b/apps/web/app/layout.tsx
@@ -3,8 +3,8 @@ import React from 'react';
 import { AuthProvider } from '../lib/auth-context';
 
 export const metadata = {
-  title: 'Velox WhatsApp SaaS Automator',
-  description: 'Painel multi-tenant de automação de convites no WhatsApp em milissegundos',
+  title: 'Velox Automator | Automação Inteligente de Convites',
+  description: 'Painel exclusivo de automação e aceite instantâneo de convites para prestadores',
 };
 
 export default function RootLayout({ children }: { children: React.ReactNode }) {
diff --git a/apps/web/app/login/page.tsx b/apps/web/app/login/page.tsx
index 692ff50..97fab2e 100644
--- a/apps/web/app/login/page.tsx
+++ b/apps/web/app/login/page.tsx
@@ -20,7 +20,6 @@ export default function LoginPage() {
     setErrorMsg(null);
 
     try {
-      // Login exclusivo de prestadores previamente cadas
```

### Commit 9: `259ca57` — feat: adicionar chave ON/OFF para ativar/pausar aceites automaticos pelo prestador

- **Hash Completo**: `259ca5717d98096680ec1a27f9622af2688e955c`
- **Data**: Fri Jul 24 14:10:58 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat: adicionar chave ON/OFF para ativar/pausar aceites automaticos pelo prestador`
- **Resumo das Alterações (git stat)**:
```text
259ca57 feat: adicionar chave ON/OFF para ativar/pausar aceites automaticos pelo prestador
 apps/web/app/page.tsx          | 67 ++++++++++++++++++++++++++++--------------
 apps/web/components/Navbar.tsx | 35 ++++++++++++++++++----
 apps/worker/src/index.ts       | 18 +++++++-----
 apps/worker/src/whatsapp.ts    | 38 ++++++++++++++++++------
 packages/database/schema.sql   |  7 +++--
 packages/database/src/index.ts | 23 +++++++++++++++
 packages/types/src/index.ts    |  1 +
 schema.sql                     |  7 +++--
 8 files changed, 146 insertions(+), 50 deletions(-)
```
- **Fact**: O commit `259ca57` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Fri Jul 24 14:10.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 259ca5717d98096680ec1a27f9622af2688e955c
Author: MachareteL <macharetelucas@gmail.com>
Date:   Fri Jul 24 14:10:58 2026 -0300

    feat: adicionar chave ON/OFF para ativar/pausar aceites automaticos pelo prestador

diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx
index 2c027c9..950351a 100644
--- a/apps/web/app/page.tsx
+++ b/apps/web/app/page.tsx
@@ -10,13 +10,14 @@ import { MetricsCards } from '../components/MetricsCards';
 import { CallsFeed } from '../components/CallsFeed';
 import { SystemLogViewer } from '../components/SystemLogViewer';
 import { QRModal } from '../components/QRModal';
-import { Activity } from 'lucide-react';
+import { Activity, AlertTriangle, PauseCircle } from 'lucide-react';
 
 export default function DashboardPage() {
   const router = useRouter();
   const { user, loading: authLoading } = useAuth();
 
   const [sessionStatus, setSessionStatus] = useState<WhatsAppSessionStatus>('DISCONNECTED');
+  const [isActive, setIsActive] = useState<boolean>(true);
   const [qrCode, setQrCode] = useState<string | null>(null);
   const [isQRModalOpen, setIsQRModalOpen] = useState(false);
 
@@ -33,9 +34,7 @@ export default function DashboardPage() {
```

### Commit 10: `4790332` — feat: implementacao de reconexao segura Anti-Ban (Exponential Backoff) e Retry inteligente no VeloxScraper

- **Hash Completo**: `479033218bdda175e31a28fd56bee54462df0037`
- **Data**: Fri Jul 24 16:14:05 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat: implementacao de reconexao segura Anti-Ban (Exponential Backoff) e Retry inteligente no VeloxScraper`
- **Resumo das Alterações (git stat)**:
```text
4790332 feat: implementacao de reconexao segura Anti-Ban (Exponential Backoff) e Retry inteligente no VeloxScraper
 apps/worker/src/scraper.ts  | 218 +++++++++++++++++++++++++-------------------
 apps/worker/src/whatsapp.ts |  64 +++++++++++--
 2 files changed, 180 insertions(+), 102 deletions(-)
```
- **Fact**: O commit `4790332` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Fri Jul 24 16:14.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 479033218bdda175e31a28fd56bee54462df0037
Author: MachareteL <macharetelucas@gmail.com>
Date:   Fri Jul 24 16:14:05 2026 -0300

    feat: implementacao de reconexao segura Anti-Ban (Exponential Backoff) e Retry inteligente no VeloxScraper

diff --git a/apps/worker/src/scraper.ts b/apps/worker/src/scraper.ts
index 62e9413..c9b6d33 100644
--- a/apps/worker/src/scraper.ts
+++ b/apps/worker/src/scraper.ts
@@ -1,6 +1,6 @@
 import axios, { AxiosInstance } from 'axios';
 import * as cheerio from 'cheerio';
-import type { AcceptPayload, InviteData } from '@velox/types';
+import type { AcceptPayload } from '@velox/types';
 import { calcularPrevia } from './calculator';
 
 export interface ScraperResult {
@@ -13,6 +13,14 @@ export interface ScraperResult {
   payload?: AcceptPayload;
   responsePayload?: Record<string, unknown>;
   errorMessage?: string;
+  attemptsMade: number;
+}
+
+export class NonRetryableError extends Error {
+  constructor(message: string) {
+    super(message);
+    this.name = 'NonRetryableError';
+  }
 }
 
 export class VeloxScraper {
@@ -29,109 +37,135 @@ export class VeloxScraper {
   }
 
   /**
-   * Processa a URL de convite do Velox realizando o GET (pars
```

### Commit 11: `d13521d` — feat: implementacao de Gestao de Frota simplificada, relatorio por veiculo e controle de atendimentos simultaneos

- **Hash Completo**: `d13521d21f8a28bde0a728a12da412f92f0d55f2`
- **Data**: Fri Jul 24 20:43:58 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat: implementacao de Gestao de Frota simplificada, relatorio por veiculo e controle de atendimentos simultaneos`
- **Resumo das Alterações (git stat)**:
```text
d13521d feat: implementacao de Gestao de Frota simplificada, relatorio por veiculo e controle de atendimentos simultaneos
 apps/web/app/page.tsx                | 108 +++++++++++++-------
 apps/web/components/CallsFeed.tsx    | 191 +++++++++++++++++++++++------------
 apps/web/components/FleetManager.tsx | 184 +++++++++++++++++++++++++++++++++
 apps/worker/src/whatsapp.ts          | 109 ++++++++++++++------
 packages/database/src/index.ts       |  22 ++++
 packages/types/src/index.ts          |  12 +++
 6 files changed, 496 insertions(+), 130 deletions(-)
```
- **Fact**: O commit `d13521d` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Fri Jul 24 20:43.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit d13521d21f8a28bde0a728a12da412f92f0d55f2
Author: MachareteL <macharetelucas@gmail.com>
Date:   Fri Jul 24 20:43:58 2026 -0300

    feat: implementacao de Gestao de Frota simplificada, relatorio por veiculo e controle de atendimentos simultaneos

diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx
index 950351a..f2cbebc 100644
--- a/apps/web/app/page.tsx
+++ b/apps/web/app/page.tsx
@@ -1,16 +1,17 @@
 'use client';
 
-import React, { useEffect, useState } from 'react';
+import React, { useEffect, useState, useCallback } from 'react';
 import { useRouter } from 'next/navigation';
-import type { CapturedCall, SystemLog, WhatsAppSession, WhatsAppSessionStatus } from '@velox/types';
+import type { CapturedCall, SystemLog, Vehicle, WhatsAppSession, WhatsAppSessionStatus } from '@velox/types';
 import { supabase } from '../lib/supabase';
 import { useAuth } from '../lib/auth-context';
 import { Navbar } from '../components/Navbar';
 import { MetricsCards } from '../components/MetricsCards';
+import { FleetManager } from '../components/FleetManager';
 import { CallsFeed } from '../components/CallsFeed';
 import { SystemLogViewer } from '../components/SystemLogViewer';
 import
```

### Commit 12: `34af96b` — style: redesenhar interface UX/UI do Velox Automator para padrao glassmorphism moderno, responsivo e intuitivo

- **Hash Completo**: `34af96b0e35b6285b3457f8e1f427955b794ece1`
- **Data**: Fri Jul 24 21:50:40 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `style: redesenhar interface UX/UI do Velox Automator para padrao glassmorphism moderno, responsivo e intuitivo`
- **Resumo das Alterações (git stat)**:
```text
34af96b style: redesenhar interface UX/UI do Velox Automator para padrao glassmorphism moderno, responsivo e intuitivo
 apps/web/app/globals.css                |  58 ++++++++++++--
 apps/web/app/login/page.tsx             | 138 +++++++++++++++++---------------
 apps/web/components/CallsFeed.tsx       | 133 +++++++++++++++++++++++-------
 apps/web/components/FleetManager.tsx    |  62 +++++++-------
 apps/web/components/MetricsCards.tsx    |  69 +++++++++-------
 apps/web/components/Navbar.tsx          |  89 ++++++++++----------
 apps/web/components/QRModal.tsx         |  56 +++++++++----
 apps/web/components/SystemLogViewer.tsx |  86 ++++++++++++++++----
 8 files changed, 459 insertions(+), 232 deletions(-)
```
- **Fact**: O commit `34af96b` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Fri Jul 24 21:50.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 34af96b0e35b6285b3457f8e1f427955b794ece1
Author: MachareteL <macharetelucas@gmail.com>
Date:   Fri Jul 24 21:50:40 2026 -0300

    style: redesenhar interface UX/UI do Velox Automator para padrao glassmorphism moderno, responsivo e intuitivo

diff --git a/apps/web/app/globals.css b/apps/web/app/globals.css
index 4b2ebde..1db881f 100644
--- a/apps/web/app/globals.css
+++ b/apps/web/app/globals.css
@@ -4,18 +4,64 @@
 
 @layer base {
   body {
-    background-color: #0b0f19;
+    background-color: #080c14;
     color: #f3f4f6;
     font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
   }
+
+  /* Custom Smooth Scrollbar */
+  ::-webkit-scrollbar {
+    width: 6px;
+    height: 6px;
+  }
+  ::-webkit-scrollbar-track {
+    background: #090d16;
+  }
+  ::-webkit-scrollbar-thumb {
+    background: #1f2937;
+    border-radius: 9999px;
+  }
+  ::-webkit-scrollbar-thumb:hover {
+    background: #374151;
+  }
 }
 
 .glass-panel {
-  background: rgba(17, 24, 39, 0.7);
-  backdrop-filter: blur(16px);
-  border: 1px solid rgba(255, 255, 255, 0.08);
+  background: rgba(15, 23, 42, 0.65);
+  backdrop-filter: blur(20px);
+  -w
```

### Commit 13: `5a51317` — feat(worker): add PUPPETEER_EXECUTABLE_PATH support for ARM64/Linux

- **Hash Completo**: `5a513176bc4565bc306f68a067c273e92b4fba15`
- **Data**: Sat Jul 25 12:22:25 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(worker): add PUPPETEER_EXECUTABLE_PATH support for ARM64/Linux`
- **Resumo das Alterações (git stat)**:
```text
5a51317 feat(worker): add PUPPETEER_EXECUTABLE_PATH support for ARM64/Linux
 apps/worker/src/whatsapp.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```
- **Fact**: O commit `5a51317` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sat Jul 25 12:22.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 5a513176bc4565bc306f68a067c273e92b4fba15
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sat Jul 25 12:22:25 2026 -0300

    feat(worker): add PUPPETEER_EXECUTABLE_PATH support for ARM64/Linux

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index d5ad25a..c2204cf 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -55,7 +55,7 @@ export class WhatsAppWorker {
       ],
     };
 
-    const systemChromePath = getWindowsChromePath();
+    const systemChromePath = getWindowsChromePath() || process.env.PUPPETEER_EXECUTABLE_PATH;
     if (systemChromePath) {
       console.log(`[Worker] Utilizando navegador Chrome instalado em: ${systemChromePath}`);
       puppeteerConfig.executablePath = systemChromePath;
```

### Commit 14: `514a59f` — fix(vercel): build monorepo dependencies before next build and remove static fallback keys

- **Hash Completo**: `514a59f0d1f55b56137f4e0c840f56b7a1318f76`
- **Data**: Sat Jul 25 13:11:13 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(vercel): build monorepo dependencies before next build and remove static fallback keys`
- **Resumo das Alterações (git stat)**:
```text
514a59f fix(vercel): build monorepo dependencies before next build and remove static fallback keys
 apps/web/lib/supabase.ts | 10 ++++++----
 apps/web/package.json    |  2 +-
 apps/worker/src/index.ts | 11 +++++++----
 3 files changed, 14 insertions(+), 9 deletions(-)
```
- **Fact**: O commit `514a59f` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sat Jul 25 13:11.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 514a59f0d1f55b56137f4e0c840f56b7a1318f76
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sat Jul 25 13:11:13 2026 -0300

    fix(vercel): build monorepo dependencies before next build and remove static fallback keys

diff --git a/apps/web/lib/supabase.ts b/apps/web/lib/supabase.ts
index 2015a15..0b3748c 100644
--- a/apps/web/lib/supabase.ts
+++ b/apps/web/lib/supabase.ts
@@ -1,9 +1,11 @@
 import { createSupabaseClient } from '@velox/database';
 
-const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mirwwmcykalshpfangbd.supabase.co';
-const SUPABASE_ANON_KEY =
-  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
-  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcnd3bWN5a2Fsc2hwZmFuZ2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDk2NjIsImV4cCI6MjEwMDQyNTY2Mn0.M5HpVaG8EvXNK0YY-kHJuZEm3Hr0V95HPNE3CMy5ezI';
+const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
+const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
+
+if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
+  console.warn('[Supabase] ATENÇÃO: As variáveis NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão definidas!');
+}
 
 export const
```

### Commit 15: `474f975` — fix(database): allow safe placeholder initialization during Next.js SSG build

- **Hash Completo**: `474f97500c5da0ad07a3e8e34f58561f9d8df4d7`
- **Data**: Sat Jul 25 13:12:12 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(database): allow safe placeholder initialization during Next.js SSG build`
- **Resumo das Alterações (git stat)**:
```text
474f975 fix(database): allow safe placeholder initialization during Next.js SSG build
 packages/database/src/index.ts | 10 ++--------
 1 file changed, 2 insertions(+), 8 deletions(-)
```
- **Fact**: O commit `474f975` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sat Jul 25 13:12.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 474f97500c5da0ad07a3e8e34f58561f9d8df4d7
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sat Jul 25 13:12:12 2026 -0300

    fix(database): allow safe placeholder initialization during Next.js SSG build

diff --git a/packages/database/src/index.ts b/packages/database/src/index.ts
index 60a5d3d..7aebc3a 100644
--- a/packages/database/src/index.ts
+++ b/packages/database/src/index.ts
@@ -12,14 +12,8 @@ export function createSupabaseClient(
   supabaseUrl?: string,
   supabaseKey?: string
 ): SupabaseClient {
-  const url = supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
-  const key = supabaseKey || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
-
-  if (!url || !key) {
-    throw new Error(
-      'Configuração do Supabase ausente. Defina SUPABASE_URL e SUPABASE_ANON_KEY.'
-    );
-  }
+  const url = supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
+  const key = supabaseKey || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';
 
   return createClient(url, key);
```

### Commit 16: `ba8bf31` — fix(database): add @types/node devDependency to resolve process global

- **Hash Completo**: `ba8bf312404f9ac6a1a9944ed43a1b4b51d4a2e7`
- **Data**: Sat Jul 25 13:14:39 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(database): add @types/node devDependency to resolve process global`
- **Resumo das Alterações (git stat)**:
```text
ba8bf31 fix(database): add @types/node devDependency to resolve process global
 packages/database/package.json | 1 +
 1 file changed, 1 insertion(+)
```
- **Fact**: O commit `ba8bf31` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sat Jul 25 13:14.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit ba8bf312404f9ac6a1a9944ed43a1b4b51d4a2e7
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sat Jul 25 13:14:39 2026 -0300

    fix(database): add @types/node devDependency to resolve process global

diff --git a/packages/database/package.json b/packages/database/package.json
index 61820bf..aeb014d 100644
--- a/packages/database/package.json
+++ b/packages/database/package.json
@@ -12,6 +12,7 @@
     "@velox/types": "1.0.0"
   },
   "devDependencies": {
+    "@types/node": "^22.13.1",
     "typescript": "^5.7.3"
   }
 }
```

### Commit 17: `5060981` — fix(orchestrator): stop worker when tenant/session is deleted from database

- **Hash Completo**: `50609815d3a071f310263c2fa6cff83e5b9d60e8`
- **Data**: Sat Jul 25 13:29:20 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(orchestrator): stop worker when tenant/session is deleted from database`
- **Resumo das Alterações (git stat)**:
```text
5060981 fix(orchestrator): stop worker when tenant/session is deleted from database
 apps/worker/src/index.ts | 9 +++++++++
 1 file changed, 9 insertions(+)
```
- **Fact**: O commit `5060981` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sat Jul 25 13:29.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 50609815d3a071f310263c2fa6cff83e5b9d60e8
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sat Jul 25 13:29:20 2026 -0300

    fix(orchestrator): stop worker when tenant/session is deleted from database

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index 65de39f..20dbbb5 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -73,6 +73,15 @@ async function main() {
         table: 'whatsapp_sessions',
       },
       async (payload: any) => {
+        if (payload.eventType === 'DELETE') {
+          const oldSession = payload.old;
+          if (oldSession && oldSession.tenant_id) {
+            console.log(`[Orchestrator] Sessão deletada do banco [tenant: ${oldSession.tenant_id}]. Encerrando worker...`);
+            await stopWorkerForTenant(oldSession.tenant_id);
+          }
+          return;
+        }
+
         const session = payload.new;
         if (!session) return;
```

### Commit 18: `c7fd219` — feat(scraper): add comprehensive diagnostic logging, multi-strategy form extraction and frontend debug inspector

- **Hash Completo**: `c7fd21952de6de2703cb9fb0c8f663c3c8cc6d07`
- **Data**: Sat Jul 25 21:39:26 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(scraper): add comprehensive diagnostic logging, multi-strategy form extraction and frontend debug inspector`
- **Resumo das Alterações (git stat)**:
```text
c7fd219 feat(scraper): add comprehensive diagnostic logging, multi-strategy form extraction and frontend debug inspector
 apps/web/components/SystemLogViewer.tsx |  66 +++++++---
 apps/worker/src/scraper.ts              | 209 +++++++++++++++++++++++++-------
 apps/worker/src/whatsapp.ts             |  19 ++-
 3 files changed, 232 insertions(+), 62 deletions(-)
```
- **Fact**: O commit `c7fd219` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sat Jul 25 21:39.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit c7fd21952de6de2703cb9fb0c8f663c3c8cc6d07
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sat Jul 25 21:39:26 2026 -0300

    feat(scraper): add comprehensive diagnostic logging, multi-strategy form extraction and frontend debug inspector

diff --git a/apps/web/components/SystemLogViewer.tsx b/apps/web/components/SystemLogViewer.tsx
index 65dea13..0d76f96 100644
--- a/apps/web/components/SystemLogViewer.tsx
+++ b/apps/web/components/SystemLogViewer.tsx
@@ -1,7 +1,7 @@
 'use client';
 
 import React, { useState } from 'react';
-import { Terminal, ShieldAlert, Info, AlertTriangle, Filter } from 'lucide-react';
+import { Terminal, ShieldAlert, Info, AlertTriangle, ChevronDown, ChevronUp, Code2 } from 'lucide-react';
 import type { SystemLog } from '@velox/types';
 
 interface SystemLogViewerProps {
@@ -10,6 +10,7 @@ interface SystemLogViewerProps {
 
 export function SystemLogViewer({ logs }: SystemLogViewerProps) {
   const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
+  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
 
   const getLogIcon = (level: string) => {
     switch (level) {
@@ -48,10 +49,14 @@ expor
```

### Commit 19: `ccd3d86` — fix(scraper): remove mandatory IdAtendimentoConvite requirement which blocked valid Velox invites

- **Hash Completo**: `ccd3d86539d5875dd20225e866086c4467022549`
- **Data**: Sat Jul 25 21:46:22 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(scraper): remove mandatory IdAtendimentoConvite requirement which blocked valid Velox invites`
- **Resumo das Alterações (git stat)**:
```text
ccd3d86 fix(scraper): remove mandatory IdAtendimentoConvite requirement which blocked valid Velox invites
 apps/worker/src/scraper.ts | 14 ++++++--------
 1 file changed, 6 insertions(+), 8 deletions(-)
```
- **Fact**: O commit `ccd3d86` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sat Jul 25 21:46.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit ccd3d86539d5875dd20225e866086c4467022549
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sat Jul 25 21:46:22 2026 -0300

    fix(scraper): remove mandatory IdAtendimentoConvite requirement which blocked valid Velox invites

diff --git a/apps/worker/src/scraper.ts b/apps/worker/src/scraper.ts
index 9079cba..6172007 100644
--- a/apps/worker/src/scraper.ts
+++ b/apps/worker/src/scraper.ts
@@ -180,19 +180,17 @@ export class VeloxScraper {
         });
         debugInfo.scriptJsonFound = scriptJson;
 
-        // Estratégia C: Extrair parâmetro da URL do convite como fallback final
+        // Estratégia C: Extrair parâmetro ChaveConvite da URL do convite como fallback final
+        let chaveConvite = '';
         try {
           const parsedUrl = new URL(url);
-          const chaveQuery = parsedUrl.searchParams.get('ChaveConvite');
-          if (!idAtendimentoConvite && chaveQuery) {
-            idAtendimentoConvite = chaveQuery;
-          }
+          chaveConvite = parsedUrl.searchParams.get('ChaveConvite') || '';
         } catch {
           // Ignore URL parse error
         }
 
-        // Validação estrita
-        if (!id || !idAtendimentoConvite) {
+
```

### Commit 20: `0b903e8` — feat: add PM2 log timestamps and update close distance preview to 50min

- **Hash Completo**: `0b903e8868b612d2660a67de18ae2a112eee1cda`
- **Data**: Sun Jul 26 16:31:04 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat: add PM2 log timestamps and update close distance preview to 50min`
- **Resumo das Alterações (git stat)**:
```text
0b903e8 feat: add PM2 log timestamps and update close distance preview to 50min
 apps/web/components/CallsFeed.tsx |  4 ++--
 apps/worker/src/calculator.ts     |  4 ++--
 apps/worker/src/whatsapp.ts       |  2 +-
 ecosystem.config.js               | 28 ++++++++--------------------
 4 files changed, 13 insertions(+), 25 deletions(-)
```
- **Fact**: O commit `0b903e8` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sun Jul 26 16:31.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 0b903e8868b612d2660a67de18ae2a112eee1cda
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sun Jul 26 16:31:04 2026 -0300

    feat: add PM2 log timestamps and update close distance preview to 50min

diff --git a/apps/web/components/CallsFeed.tsx b/apps/web/components/CallsFeed.tsx
index e1c80b1..16ee00d 100644
--- a/apps/web/components/CallsFeed.tsx
+++ b/apps/web/components/CallsFeed.tsx
@@ -48,7 +48,7 @@ export function CallsFeed({ calls, onRefreshCalls }: CallsFeedProps) {
     }
 
     const createdAtMs = new Date(call.created_at).getTime();
-    const durationMin = call.previa_minutos || 90;
+    const durationMin = call.previa_minutos || 50;
     const isStillActive = Date.now() < createdAtMs + durationMin * 60 * 1000;
 
     if (isStillActive) {
@@ -210,7 +210,7 @@ export function CallsFeed({ calls, onRefreshCalls }: CallsFeedProps) {
                     <td className="py-3.5 px-4 font-semibold text-white">
                       <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-mono">
                         <Clock className="w-3.5 h-3.5 text-amber-400" />
-                        {call.previa_minutos || 90} min
+
```

### Commit 21: `83b74a3` — fix(database): add missing RLS UPDATE policy for captured_calls and use maybeSingle in completeCapturedCall

- **Hash Completo**: `83b74a3ff08c4b4c42ac0f4b313b699620075236`
- **Data**: Sun Jul 26 16:34:07 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(database): add missing RLS UPDATE policy for captured_calls and use maybeSingle in completeCapturedCall`
- **Resumo das Alterações (git stat)**:
```text
83b74a3 fix(database): add missing RLS UPDATE policy for captured_calls and use maybeSingle in completeCapturedCall
 packages/database/src/index.ts | 2 +-
 schema.sql                     | 4 ++++
 2 files changed, 5 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `83b74a3` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Sun Jul 26 16:34.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 83b74a3ff08c4b4c42ac0f4b313b699620075236
Author: MachareteL <macharetelucas@gmail.com>
Date:   Sun Jul 26 16:34:07 2026 -0300

    fix(database): add missing RLS UPDATE policy for captured_calls and use maybeSingle in completeCapturedCall

diff --git a/packages/database/src/index.ts b/packages/database/src/index.ts
index 7aebc3a..35389ba 100644
--- a/packages/database/src/index.ts
+++ b/packages/database/src/index.ts
@@ -86,7 +86,7 @@ export async function completeCapturedCall(
     })
     .eq('id', callId)
     .select('*')
-    .single();
+    .maybeSingle();
 
   if (error) {
     console.error('Erro ao finalizar chamado:', error.message);
diff --git a/schema.sql b/schema.sql
index 730ace6..f44b711 100644
--- a/schema.sql
+++ b/schema.sql
@@ -138,6 +138,10 @@ DROP POLICY IF EXISTS "Calls - Permissao de Insercao" ON public.captured_calls;
 CREATE POLICY "Calls - Permissao de Insercao" ON public.captured_calls
   FOR INSERT WITH CHECK (true);
 
+DROP POLICY IF EXISTS "Calls - Permissao de Atualizacao" ON public.captured_calls;
+CREATE POLICY "Calls - Permissao de Atualizacao" ON public.captured_calls
+  FOR UPDATE USING (true);
+
 -- 8. POLÍTICAS DE RLS PARA `system_logs`
```

### Commit 22: `472c123` — feat(logging): add structured step-by-step console logs with timing for GET, Parsing, and POST requests

- **Hash Completo**: `472c1231bd83993b6cfdbe81c660d1461346476e`
- **Data**: Mon Jul 27 11:32:21 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(logging): add structured step-by-step console logs with timing for GET, Parsing, and POST requests`
- **Resumo das Alterações (git stat)**:
```text
472c123 feat(logging): add structured step-by-step console logs with timing for GET, Parsing, and POST requests
 apps/worker/src/scraper.ts | 121 +++++++++++++++++++++++++++++++++------------
 1 file changed, 89 insertions(+), 32 deletions(-)
```
- **Fact**: O commit `472c123` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 11:32.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 472c1231bd83993b6cfdbe81c660d1461346476e
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 11:32:21 2026 -0300

    feat(logging): add structured step-by-step console logs with timing for GET, Parsing, and POST requests

diff --git a/apps/worker/src/scraper.ts b/apps/worker/src/scraper.ts
index 6172007..2e8ed07 100644
--- a/apps/worker/src/scraper.ts
+++ b/apps/worker/src/scraper.ts
@@ -15,6 +15,12 @@ export interface ScraperDebugInfo {
   allInputsFound?: Record<string, string>;
   scriptJsonFound?: Record<string, unknown> | null;
   errorStack?: string;
+  timingMs?: {
+    getMs: number;
+    parseMs: number;
+    postMs: number;
+    totalMs: number;
+  };
 }
 
 export interface ScraperResult {
@@ -45,7 +51,7 @@ export class VeloxScraper {
     this.http = axios.create({
       timeout: timeoutMs,
       maxRedirects: 5,
-      validateStatus: () => true, // Permite capturar respostas como 302, 400, 404 sem estourar exceção imediatamente
+      validateStatus: () => true, // Captura 200, 302, 400, 404 sem lançar exceção imediata
       headers: {
         'User-Agent':
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Ge
```

### Commit 23: `fdb3530` — fix(ui): melhora feedback ao gerar QR Code e ajusta responsividade do header no mobile

- **Hash Completo**: `fdb3530ad155bc98b47e7e07dec2ff0210549e1b`
- **Data**: Mon Jul 27 13:01:57 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(ui): melhora feedback ao gerar QR Code e ajusta responsividade do header no mobile`
- **Resumo das Alterações (git stat)**:
```text
fdb3530 fix(ui): melhora feedback ao gerar QR Code e ajusta responsividade do header no mobile
 apps/web/components/Navbar.tsx  | 46 ++++++++++++++++++++---------------------
 apps/web/components/QRModal.tsx | 27 ++++++++++++++++++------
 2 files changed, 44 insertions(+), 29 deletions(-)
```
- **Fact**: O commit `fdb3530` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 13:01.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit fdb3530ad155bc98b47e7e07dec2ff0210549e1b
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 13:01:57 2026 -0300

    fix(ui): melhora feedback ao gerar QR Code e ajusta responsividade do header no mobile

diff --git a/apps/web/components/Navbar.tsx b/apps/web/components/Navbar.tsx
index d17e614..7108f3f 100644
--- a/apps/web/components/Navbar.tsx
+++ b/apps/web/components/Navbar.tsx
@@ -19,28 +19,28 @@ export function Navbar({ status, isActive, onToggleActive, onOpenQR }: NavbarPro
     switch (status) {
       case 'CONNECTED':
         return (
-          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
-            <span className="relative flex h-2 w-2">
+          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner shrink-0">
+            <span className="relative flex h-2 w-2 shrink-0">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
```

### Commit 24: `429a257` — feat: add 300ms delay when retrying

- **Hash Completo**: `429a257d59e51f6c6f43db8e074aa8b5f714d7ea`
- **Data**: Mon Jul 27 13:05:37 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat: add 300ms delay when retrying`
- **Resumo das Alterações (git stat)**:
```text
429a257 feat: add 300ms delay when retrying
 apps/worker/src/scraper.ts | 1 +
 1 file changed, 1 insertion(+)
```
- **Fact**: O commit `429a257` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 13:05.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 429a257d59e51f6c6f43db8e074aa8b5f714d7ea
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 13:05:37 2026 -0300

    feat: add 300ms delay when retrying

diff --git a/apps/worker/src/scraper.ts b/apps/worker/src/scraper.ts
index 2e8ed07..92ce5f6 100644
--- a/apps/worker/src/scraper.ts
+++ b/apps/worker/src/scraper.ts
@@ -327,6 +327,7 @@ export class VeloxScraper {
 
         if (attempt < maxAttempts) {
           console.warn(`[Scraper] 🔄 Erro temporário na tentativa ${attempt}. Aguardando 300ms para re-tentar...`);
+          await new Promise((r) => setTimeout(r, 300));
         }
         console.log(`================================================================================\n`);
       }
```

### Commit 25: `69ee54c` — feat(whatsapp): add phone number pairing code (8-digit) authentication flow

- **Hash Completo**: `69ee54c7aa3de7d97e150d96d93d6b9ae03a83d9`
- **Data**: Mon Jul 27 14:18:43 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(whatsapp): add phone number pairing code (8-digit) authentication flow`
- **Resumo das Alterações (git stat)**:
```text
69ee54c feat(whatsapp): add phone number pairing code (8-digit) authentication flow
 apps/web/app/page.tsx           |   6 +
 apps/web/components/QRModal.tsx | 310 ++++++++++++++++++++++++++++++++--------
 apps/worker/src/index.ts        |  10 +-
 apps/worker/src/whatsapp.ts     |  42 +++++-
 packages/database/src/index.ts  |  37 ++++-
 packages/types/src/index.ts     |   2 +
 schema.sql                      |   2 +
 7 files changed, 340 insertions(+), 69 deletions(-)
```
- **Fact**: O commit `69ee54c` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 14:18.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 69ee54c7aa3de7d97e150d96d93d6b9ae03a83d9
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 14:18:43 2026 -0300

    feat(whatsapp): add phone number pairing code (8-digit) authentication flow

diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx
index f2cbebc..8be9375 100644
--- a/apps/web/app/page.tsx
+++ b/apps/web/app/page.tsx
@@ -20,6 +20,8 @@ export default function DashboardPage() {
   const [sessionStatus, setSessionStatus] = useState<WhatsAppSessionStatus>('DISCONNECTED');
   const [isActive, setIsActive] = useState<boolean>(true);
   const [qrCode, setQrCode] = useState<string | null>(null);
+  const [pairingCode, setPairingCode] = useState<string | null>(null);
+  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
   const [isQRModalOpen, setIsQRModalOpen] = useState(false);
 
   const [vehicles, setVehicles] = useState<Vehicle[]>([]);
@@ -125,6 +127,8 @@ export default function DashboardPage() {
             setSessionStatus(updated.status);
             setIsActive(updated.is_active !== false);
             setQrCode(updated.qr_code || null);
+            setPairingCode(updated.pairing_code || null);
+            setPhoneNum
```

### Commit 26: `6453372` — fix(whatsapp): handle on-demand pairing code generation for existing active workers

- **Hash Completo**: `6453372d30cbbbe5b33e7270feabe3d3d44e5349`
- **Data**: Mon Jul 27 14:28:15 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(whatsapp): handle on-demand pairing code generation for existing active workers`
- **Resumo das Alterações (git stat)**:
```text
6453372 fix(whatsapp): handle on-demand pairing code generation for existing active workers
 apps/web/components/QRModal.tsx | 11 ++++++++++-
 apps/worker/src/index.ts        |  3 +++
 apps/worker/src/whatsapp.ts     | 37 +++++++++++++++++++++++++++++++++++++
 3 files changed, 50 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `6453372` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 14:28.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 6453372d30cbbbe5b33e7270feabe3d3d44e5349
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 14:28:15 2026 -0300

    fix(whatsapp): handle on-demand pairing code generation for existing active workers

diff --git a/apps/web/components/QRModal.tsx b/apps/web/components/QRModal.tsx
index d5b6e64..c37c3c1 100644
--- a/apps/web/components/QRModal.tsx
+++ b/apps/web/components/QRModal.tsx
@@ -116,13 +116,22 @@ export function QRModal({ isOpen, onClose, status, qrCode, pairingCode, phoneNum
     setTimeout(() => setCopied(false), 2500);
   };
 
+  React.useEffect(() => {
+    if (phoneNumber || pairingCode) {
+      setConnectMethod('PHONE');
+    }
+  }, [phoneNumber, pairingCode]);
+
   const formattedPairingCode = pairingCode
     ? pairingCode.length === 8
       ? `${pairingCode.slice(0, 4)} - ${pairingCode.slice(4)}`
       : pairingCode
     : null;
 
-  const isGenerating = loading || (status === 'DISCONNECTED_NEED_QR' && connectMethod === 'QR' && !qrCode) || (status === 'DISCONNECTED_NEED_QR' && connectMethod === 'PHONE' && !pairingCode && Boolean(phoneNumber));
+  const isGenerating =
+    loading ||
+    (status === 'DISCONNECTED_NEED_QR' && connectMethod
```

### Commit 27: `54d6c8a` — fix(web): resolve React Error #310 by moving early return after all hook declarations

- **Hash Completo**: `54d6c8aafc34175646ffccd7eacf7272b8c62ed9`
- **Data**: Mon Jul 27 14:32:31 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(web): resolve React Error #310 by moving early return after all hook declarations`
- **Resumo das Alterações (git stat)**:
```text
54d6c8a fix(web): resolve React Error #310 by moving early return after all hook declarations
 apps/web/components/QRModal.tsx | 4 +++-
 1 file changed, 3 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `54d6c8a` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 14:32.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 54d6c8aafc34175646ffccd7eacf7272b8c62ed9
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 14:32:31 2026 -0300

    fix(web): resolve React Error #310 by moving early return after all hook declarations

diff --git a/apps/web/components/QRModal.tsx b/apps/web/components/QRModal.tsx
index c37c3c1..0ec7e08 100644
--- a/apps/web/components/QRModal.tsx
+++ b/apps/web/components/QRModal.tsx
@@ -24,7 +24,7 @@ export function QRModal({ isOpen, onClose, status, qrCode, pairingCode, phoneNum
   const [copied, setCopied] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
 
-  if (!isOpen) return null;
+
 
   // Formatação com Máscara +55 (XX) XXXXX-XXXX
   const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
@@ -133,6 +133,8 @@ export function QRModal({ isOpen, onClose, status, qrCode, pairingCode, phoneNum
     (status === 'DISCONNECTED_NEED_QR' && connectMethod === 'QR' && !qrCode) ||
     (connectMethod === 'PHONE' && !pairingCode && (Boolean(phoneNumber) || Boolean(inputPhone)));
 
+  if (!isOpen) return null;
+
   return (
     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blac
```

### Commit 28: `e3a2e8f` — build: make build:worker automatically compile types and database packages

- **Hash Completo**: `e3a2e8fa655e0750d511bedd67d8f75a649c5882`
- **Data**: Mon Jul 27 14:35:04 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `build: make build:worker automatically compile types and database packages`
- **Resumo das Alterações (git stat)**:
```text
e3a2e8f build: make build:worker automatically compile types and database packages
 package.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```
- **Fact**: O commit `e3a2e8f` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 14:35.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit e3a2e8fa655e0750d511bedd67d8f75a649c5882
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 14:35:04 2026 -0300

    build: make build:worker automatically compile types and database packages

diff --git a/package.json b/package.json
index 4b0bd35..45c69b0 100644
--- a/package.json
+++ b/package.json
@@ -10,7 +10,7 @@
   "scripts": {
     "build:types": "npm run build --workspace=packages/types",
     "build:database": "npm run build --workspace=packages/database",
-    "build:worker": "npm run build --workspace=apps/worker",
+    "build:worker": "npm run build:types && npm run build:database && npm run build --workspace=apps/worker",
     "build:web": "npm run build --workspace=apps/web",
     "build": "npm run build:types && npm run build:database && npm run build:worker && npm run build:web",
     "dev:worker": "npm run dev --workspace=apps/worker",
```

### Commit 29: `8fc9ae0` — fix(worker): handle Chromium CDP context navigation rejections gracefully

- **Hash Completo**: `8fc9ae0bc263ef62632949b575fcd218de40cc6b`
- **Data**: Mon Jul 27 14:43:57 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): handle Chromium CDP context navigation rejections gracefully`
- **Resumo das Alterações (git stat)**:
```text
8fc9ae0 fix(worker): handle Chromium CDP context navigation rejections gracefully
 apps/worker/src/index.ts | 11 ++++++++++-
 1 file changed, 10 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `8fc9ae0` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 14:43.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 8fc9ae0bc263ef62632949b575fcd218de40cc6b
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 14:43:57 2026 -0300

    fix(worker): handle Chromium CDP context navigation rejections gracefully

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index ebdeff3..8aed862 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -105,7 +105,16 @@ async function main() {
     console.error('[Orchestrator] Exceção não tratada:', err.message);
   });
 
-  process.on('unhandledRejection', (reason) => {
+  process.on('unhandledRejection', (reason: any) => {
+    const msg = reason?.message || String(reason || '');
+    if (
+      msg.includes('Execution context was destroyed') ||
+      msg.includes('Target closed') ||
+      msg.includes('Protocol error')
+    ) {
+      console.warn(`[Orchestrator] Reinicialização de página Chromium detectada (${msg.split('\n')[0]}).`);
+      return;
+    }
     console.error('[Orchestrator] Rejeição não tratada:', reason);
   });
 }
```

### Commit 30: `284ea3f` — fix(web): add session reset action and prevent loading state lock in QRModal

- **Hash Completo**: `284ea3f798e7b10aa7e56652eaac2c78b7a2b768`
- **Data**: Mon Jul 27 14:45:42 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(web): add session reset action and prevent loading state lock in QRModal`
- **Resumo das Alterações (git stat)**:
```text
284ea3f fix(web): add session reset action and prevent loading state lock in QRModal
 apps/web/components/QRModal.tsx | 65 ++++++++++++++++++++++++-----------------
 1 file changed, 39 insertions(+), 26 deletions(-)
```
- **Fact**: O commit `284ea3f` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 14:45.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 284ea3f798e7b10aa7e56652eaac2c78b7a2b768
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 14:45:42 2026 -0300

    fix(web): add session reset action and prevent loading state lock in QRModal

diff --git a/apps/web/components/QRModal.tsx b/apps/web/components/QRModal.tsx
index 0ec7e08..00ae527 100644
--- a/apps/web/components/QRModal.tsx
+++ b/apps/web/components/QRModal.tsx
@@ -1,7 +1,7 @@
 'use client';
 
 import React, { useState } from 'react';
-import { X, QrCode, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Phone, Copy, Check } from 'lucide-react';
+import { X, QrCode, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Phone, Copy, Check, RotateCcw } from 'lucide-react';
 import type { WhatsAppSessionStatus } from '@velox/types';
 import { supabase } from '../lib/supabase';
 import { useAuth } from '../lib/auth-context';
@@ -24,14 +24,17 @@ export function QRModal({ isOpen, onClose, status, qrCode, pairingCode, phoneNum
   const [copied, setCopied] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
 
-
+  React.useEffect(() => {
+    if (phoneNumber || pairingCode) {
+      setConnectMethod('PHONE');
+    }
+
```

### Commit 31: `04177d2` — fix(orchestrator): prevent killing active worker instances on transient disconnects to preserve background auto-reconnection

- **Hash Completo**: `04177d2ce6b0e4d4c5d180f67fe7b07a85ec41c8`
- **Data**: Mon Jul 27 14:54:41 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(orchestrator): prevent killing active worker instances on transient disconnects to preserve background auto-reconnection`
- **Resumo das Alterações (git stat)**:
```text
04177d2 fix(orchestrator): prevent killing active worker instances on transient disconnects to preserve background auto-reconnection
 apps/worker/src/index.ts    | 18 ++++++++++++------
 apps/worker/src/whatsapp.ts | 46 +++++++++++++++++++++++++++------------------
 2 files changed, 40 insertions(+), 24 deletions(-)
```
- **Fact**: O commit `04177d2` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 14:54.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 04177d2ce6b0e4d4c5d180f67fe7b07a85ec41c8
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 14:54:41 2026 -0300

    fix(orchestrator): prevent killing active worker instances on transient disconnects to preserve background auto-reconnection

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index 8aed862..c31e336 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -46,11 +46,11 @@ async function main() {
     }
   };
 
-  // 1. Carrega sessões existentes no boot
+  // 1. Carrega todas as sessões ativas do banco no boot (para reaproveitar autenticação salva em disco)
   const { data: activeSessions, error: bootErr } = await supabase
     .from('whatsapp_sessions')
     .select('*')
-    .in('status', ['DISCONNECTED_NEED_QR', 'CONNECTED']);
+    .eq('is_active', true);
 
   if (bootErr) {
     console.error('[Orchestrator] Erro ao carregar sessões no boot:', bootErr);
@@ -90,10 +90,16 @@ async function main() {
 
         console.log(`[Orchestrator] Evento de sessão [tenant: ${session.tenant_id}]: status = ${session.status}, is_active = ${session.is_active}`);
 
-        if (session.status === 'DISCONNECTED_NEED_QR' || session.
```

### Commit 32: `68a7b19` — feat(ux): add intermediate AUTHENTICATING state and smooth transition modal on mobile auth success

- **Hash Completo**: `68a7b1959bef4f15b5bc92b4f59f0c85b24e0d49`
- **Data**: Mon Jul 27 15:02:33 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(ux): add intermediate AUTHENTICATING state and smooth transition modal on mobile auth success`
- **Resumo das Alterações (git stat)**:
```text
68a7b19 feat(ux): add intermediate AUTHENTICATING state and smooth transition modal on mobile auth success
 apps/web/app/page.tsx           |  6 +++++-
 apps/web/components/Navbar.tsx  | 10 ++++++++++
 apps/web/components/QRModal.tsx | 19 +++++++++++++++++--
 apps/worker/src/whatsapp.ts     | 28 +++++++++++++++++++++++++---
 packages/types/src/index.ts     |  1 +
 5 files changed, 58 insertions(+), 6 deletions(-)
```
- **Fact**: O commit `68a7b19` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 15:02.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 68a7b1959bef4f15b5bc92b4f59f0c85b24e0d49
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 15:02:33 2026 -0300

    feat(ux): add intermediate AUTHENTICATING state and smooth transition modal on mobile auth success

diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx
index 8be9375..8bae1fe 100644
--- a/apps/web/app/page.tsx
+++ b/apps/web/app/page.tsx
@@ -130,8 +130,12 @@ export default function DashboardPage() {
             setPairingCode(updated.pairing_code || null);
             setPhoneNumber(updated.phone_number || null);
 
-            if (updated.status === 'DISCONNECTED_NEED_QR') {
+            if (updated.status === 'DISCONNECTED_NEED_QR' || updated.status === 'AUTHENTICATING') {
               setIsQRModalOpen(true);
+            } else if (updated.status === 'CONNECTED') {
+              setTimeout(() => {
+                setIsQRModalOpen(false);
+              }, 2500);
             }
           }
         }
diff --git a/apps/web/components/Navbar.tsx b/apps/web/components/Navbar.tsx
index 7108f3f..83b5497 100644
--- a/apps/web/components/Navbar.tsx
+++ b/apps/web/components/Navbar.tsx
@@ -27,6 +27,16 @@ export function Navbar({ status, i
```

### Commit 33: `aaf38d2` — fix(worker): fix try-catch syntax error in whatsapp.ts qr event

- **Hash Completo**: `aaf38d22aaf5d22a2768afba0d242e3d014c903d`
- **Data**: Mon Jul 27 15:03:34 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): fix try-catch syntax error in whatsapp.ts qr event`
- **Resumo das Alterações (git stat)**:
```text
aaf38d2 fix(worker): fix try-catch syntax error in whatsapp.ts qr event
 apps/worker/src/whatsapp.ts | 5 +++++
 1 file changed, 5 insertions(+)
```
- **Fact**: O commit `aaf38d2` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 15:03.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit aaf38d22aaf5d22a2768afba0d242e3d014c903d
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 15:03:34 2026 -0300

    fix(worker): fix try-catch syntax error in whatsapp.ts qr event

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index bb6d4ae..d6c530f 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -175,6 +175,11 @@ export class WhatsAppWorker {
           event_type: 'QR_GENERATED',
           message: 'Novo Código de Conexão (QR Code) gerado.',
         });
+      } catch (err: any) {
+        console.error('[Worker] Erro ao converter QR Code:', err.message);
+      }
+    });
+
     // Evento disparado no exato instante em que o celular aprova o QR Code ou Pairing Code
     this.client.on('authenticated', async () => {
       console.log(`[Worker] ✨ Conexão aprovada pelo celular para tenant ${this.tenantId}! Inicializando automação...`);
```

### Commit 34: `8c8c87c` — fix(security): implement QR refresh rate limits and selective boot to protect VM resources and prevent IP ban

- **Hash Completo**: `8c8c87cf6bad6458ab308efbedb00474e75471aa`
- **Data**: Mon Jul 27 15:05:58 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(security): implement QR refresh rate limits and selective boot to protect VM resources and prevent IP ban`
- **Resumo das Alterações (git stat)**:
```text
8c8c87c fix(security): implement QR refresh rate limits and selective boot to protect VM resources and prevent IP ban
 apps/worker/src/index.ts    |  9 +++++----
 apps/worker/src/whatsapp.ts | 31 ++++++++++++++++++++++++++++++-
 2 files changed, 35 insertions(+), 5 deletions(-)
```
- **Fact**: O commit `8c8c87c` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 15:05.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 8c8c87cf6bad6458ab308efbedb00474e75471aa
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 15:05:58 2026 -0300

    fix(security): implement QR refresh rate limits and selective boot to protect VM resources and prevent IP ban

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index c31e336..56d3de2 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -46,23 +46,24 @@ async function main() {
     }
   };
 
-  // 1. Carrega todas as sessões ativas do banco no boot (para reaproveitar autenticação salva em disco)
+  // 1. Carrega APENAS sessões com status CONNECTED no boot para economizar RAM/CPU da VM
   const { data: activeSessions, error: bootErr } = await supabase
     .from('whatsapp_sessions')
     .select('*')
-    .eq('is_active', true);
+    .eq('is_active', true)
+    .eq('status', 'CONNECTED');
 
   if (bootErr) {
     console.error('[Orchestrator] Erro ao carregar sessões no boot:', bootErr);
   }
 
   if (activeSessions && activeSessions.length > 0) {
-    console.log(`[Orchestrator] Encontradas ${activeSessions.length} sessões ativas no boot.`);
+    console.log(`[Orchestrator] 🚀 Inicializando ${activeSessions.length
```

### Commit 35: `a5f725f` — fix(copy): update connection modal loading text to 'Inicializando robô de automação' for privacy

- **Hash Completo**: `a5f725f43f442372985e56d56a0aeeab9ab62a16`
- **Data**: Mon Jul 27 15:06:47 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(copy): update connection modal loading text to 'Inicializando robô de automação' for privacy`
- **Resumo das Alterações (git stat)**:
```text
a5f725f fix(copy): update connection modal loading text to 'Inicializando robô de automação' for privacy
 apps/web/components/QRModal.tsx | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```
- **Fact**: O commit `a5f725f` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 15:06.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit a5f725f43f442372985e56d56a0aeeab9ab62a16
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 15:06:47 2026 -0300

    fix(copy): update connection modal loading text to 'Inicializando robô de automação' for privacy

diff --git a/apps/web/components/QRModal.tsx b/apps/web/components/QRModal.tsx
index 8d99eb6..40c8f70 100644
--- a/apps/web/components/QRModal.tsx
+++ b/apps/web/components/QRModal.tsx
@@ -214,10 +214,10 @@ export function QRModal({ isOpen, onClose, status, qrCode, pairingCode, phoneNum
                 Conexão Estabelecida com Sucesso! 🎉
               </h4>
               <p className="text-xs text-emerald-300 font-medium max-w-[280px] leading-relaxed mb-3">
-                Celular autenticado. Aguarde alguns segundos enquanto a automação sincroniza seu WhatsApp...
+                Celular autenticado com sucesso! Aguarde alguns segundos enquanto o robô de automação é inicializado...
               </p>
               <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 rounded-full border border-emerald-800/40 text-[11px] text-emerald-400">
-                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sincronizando conversas.
```

### Commit 36: `e5ff6a3` — fix(web): prevent premature loading state while typing phone number in QRModal

- **Hash Completo**: `e5ff6a38cc8d3714e0c126578e7cb1ee8e420a91`
- **Data**: Mon Jul 27 15:42:20 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(web): prevent premature loading state while typing phone number in QRModal`
- **Resumo das Alterações (git stat)**:
```text
e5ff6a3 fix(web): prevent premature loading state while typing phone number in QRModal
 apps/web/components/QRModal.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```
- **Fact**: O commit `e5ff6a3` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 15:42.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit e5ff6a38cc8d3714e0c126578e7cb1ee8e420a91
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 15:42:20 2026 -0300

    fix(web): prevent premature loading state while typing phone number in QRModal

diff --git a/apps/web/components/QRModal.tsx b/apps/web/components/QRModal.tsx
index 40c8f70..5b0cd60 100644
--- a/apps/web/components/QRModal.tsx
+++ b/apps/web/components/QRModal.tsx
@@ -125,7 +125,7 @@ export function QRModal({ isOpen, onClose, status, qrCode, pairingCode, phoneNum
   const isGenerating =
     loading ||
     (status === 'DISCONNECTED_NEED_QR' && connectMethod === 'QR' && !qrCode) ||
-    (connectMethod === 'PHONE' && !pairingCode && (Boolean(phoneNumber) || Boolean(inputPhone)));
+    (connectMethod === 'PHONE' && !pairingCode && Boolean(phoneNumber));
 
   if (!isOpen) return null;
```

### Commit 37: `140db31` — fix(worker): purge stopped worker instances on re-auth and auto-recover from detached Chromium frames

- **Hash Completo**: `140db318a18a09dca4e1644e77c4e43bc6be5a69`
- **Data**: Mon Jul 27 16:08:29 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): purge stopped worker instances on re-auth and auto-recover from detached Chromium frames`
- **Resumo das Alterações (git stat)**:
```text
140db31 fix(worker): purge stopped worker instances on re-auth and auto-recover from detached Chromium frames
 apps/worker/src/index.ts    |  7 ++++++-
 apps/worker/src/whatsapp.ts | 24 ++++++++++++++++++++++++
 2 files changed, 30 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `140db31` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 16:08.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 140db318a18a09dca4e1644e77c4e43bc6be5a69
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 16:08:29 2026 -0300

    fix(worker): purge stopped worker instances on re-auth and auto-recover from detached Chromium frames

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index 56d3de2..b1a5a70 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -22,7 +22,7 @@ async function main() {
 
   const startWorkerForTenant = async (tenantId: string, sessionId: string, isActive: boolean, phoneNumber?: string | null) => {
     let worker = activeWorkers.get(tenantId);
-    if (worker) {
+    if (worker && worker.isRunning()) {
       worker.setIsActive(isActive);
       if (phoneNumber && phoneNumber !== worker.getPhoneNumber()) {
         await worker.requestPairingCodeOnDemand(phoneNumber);
@@ -30,6 +30,11 @@ async function main() {
       return;
     }
 
+    if (worker && !worker.isRunning()) {
+      console.log(`[Orchestrator] Removendo instância inativa anterior do tenant ${tenantId}...`);
+      activeWorkers.delete(tenantId);
+    }
+
     console.log(`[Orchestrator] Iniciando worker isolado para tenant ${tenantId} [Automação: ${
```

### Commit 38: `616c156` — perf(orchestrator): add 800ms boot stagger between tenant sessions to smooth out CPU spikes on restart

- **Hash Completo**: `616c156bdeccf9b2e719d42ee5f7e1955a19410b`
- **Data**: Mon Jul 27 16:12:59 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `perf(orchestrator): add 800ms boot stagger between tenant sessions to smooth out CPU spikes on restart`
- **Resumo das Alterações (git stat)**:
```text
616c156 perf(orchestrator): add 800ms boot stagger between tenant sessions to smooth out CPU spikes on restart
 apps/worker/src/index.ts | 2 ++
 1 file changed, 2 insertions(+)
```
- **Fact**: O commit `616c156` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 16:12.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 616c156bdeccf9b2e719d42ee5f7e1955a19410b
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 16:12:59 2026 -0300

    perf(orchestrator): add 800ms boot stagger between tenant sessions to smooth out CPU spikes on restart

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index b1a5a70..7ae7687 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -66,6 +66,8 @@ async function main() {
     console.log(`[Orchestrator] 🚀 Inicializando ${activeSessions.length} sessões de WhatsApp conectadas no boot.`);
     for (const session of activeSessions) {
       await startWorkerForTenant(session.tenant_id, session.id, session.is_active !== false, session.phone_number);
+      // Stagger de 800ms para suavizar a carga de CPU da VM durante o restart
+      await new Promise((resolve) => setTimeout(resolve, 800));
     }
   } else {
     console.log('[Orchestrator] Nenhum WhatsApp conectado previamente. Aguardando solicitações no banco...');
```

### Commit 39: `e1733d0` — fix(worker): add DOM stabilization delay and phone format fallback for pairing code request

- **Hash Completo**: `e1733d0cce9ac286fb2d3cfed9636b94b8614d28`
- **Data**: Mon Jul 27 19:14:35 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): add DOM stabilization delay and phone format fallback for pairing code request`
- **Resumo das Alterações (git stat)**:
```text
e1733d0 fix(worker): add DOM stabilization delay and phone format fallback for pairing code request
 apps/worker/src/whatsapp.ts | 43 ++++++++++++++++++++++++++++++++++++++-----
 1 file changed, 38 insertions(+), 5 deletions(-)
```
- **Fact**: O commit `e1733d0` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 19:14.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit e1733d0cce9ac286fb2d3cfed9636b94b8614d28
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 19:14:35 2026 -0300

    fix(worker): add DOM stabilization delay and phone format fallback for pairing code request

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index d60e607..5076bab 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -98,6 +98,38 @@ export class WhatsAppWorker {
     return this.running;
   }
 
+  private async executePairingCodeWithRetry(phoneNumber: string): Promise<string> {
+    const cleanPhone = phoneNumber.replace(/\D/g, '');
+
+    // Aguarda 800ms para o Store.PairingCode do WhatsApp Web estabilizar no DOM
+    await new Promise((resolve) => setTimeout(resolve, 800));
+
+    // Tentativa 1: Número limpo conforme fornecido (ex: 5519997925412)
+    try {
+      const code = await (this.client as any).requestPairingCode(cleanPhone);
+      if (code && typeof code === 'string') return code;
+    } catch (err1: any) {
+      console.warn(`[Worker Pairing] Aviso na tentativa 1 (${cleanPhone}): ${err1?.message || err1}. Testando estabilização e formatos...`);
+    }
+
+    // Tentativa 2: Se for t
```

### Commit 40: `5c932a1` — fix(worker): add waitForStorePairingCode to ensure WhatsApp Web JS bundle is ready before calling requestPairingCode

- **Hash Completo**: `5c932a15f735b98c00bf10dd8f01292de0f8e745`
- **Data**: Mon Jul 27 19:17:42 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): add waitForStorePairingCode to ensure WhatsApp Web JS bundle is ready before calling requestPairingCode`
- **Resumo das Alterações (git stat)**:
```text
5c932a1 fix(worker): add waitForStorePairingCode to ensure WhatsApp Web JS bundle is ready before calling requestPairingCode
 apps/worker/src/whatsapp.ts | 31 +++++++++++++++++++++++++++----
 1 file changed, 27 insertions(+), 4 deletions(-)
```
- **Fact**: O commit `5c932a1` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 19:17.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 5c932a15f735b98c00bf10dd8f01292de0f8e745
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 19:17:42 2026 -0300

    fix(worker): add waitForStorePairingCode to ensure WhatsApp Web JS bundle is ready before calling requestPairingCode

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index 5076bab..d40b3ce 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -98,13 +98,36 @@ export class WhatsAppWorker {
     return this.running;
   }
 
+  private async waitForStorePairingCode(): Promise<boolean> {
+    console.log(`[Worker Pairing] Aguardando o módulo Store.PairingCode do WhatsApp Web inicializar no navegador...`);
+    for (let attempt = 1; attempt <= 15; attempt++) {
+      try {
+        const page = (this.client as any).pupPage;
+        if (page && !page.isClosed()) {
+          const isReady = await page.evaluate(() => {
+            return typeof (window as any).Store?.PairingCode?.requestPairingCode === 'function';
+          });
+          if (isReady) {
+            console.log(`[Worker Pairing] Módulo Store.PairingCode pronto no navegador após ${attempt * 800}ms.`);
+            return true;
+          }
```

### Commit 41: `4c74485` — fix(worker): implement progressive retry loop for pairing code generation against Webpack module injection delays

- **Hash Completo**: `4c7448517ae71347cd6cd662ea247653c4af59a5`
- **Data**: Mon Jul 27 19:30:25 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): implement progressive retry loop for pairing code generation against Webpack module injection delays`
- **Resumo das Alterações (git stat)**:
```text
4c74485 fix(worker): implement progressive retry loop for pairing code generation against Webpack module injection delays
 apps/worker/src/whatsapp.ts | 72 ++++++++++++++++++---------------------------
 1 file changed, 29 insertions(+), 43 deletions(-)
```
- **Fact**: O commit `4c74485` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 19:30.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 4c7448517ae71347cd6cd662ea247653c4af59a5
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 19:30:25 2026 -0300

    fix(worker): implement progressive retry loop for pairing code generation against Webpack module injection delays

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index d40b3ce..074864b 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -98,59 +98,45 @@ export class WhatsAppWorker {
     return this.running;
   }
 
-  private async waitForStorePairingCode(): Promise<boolean> {
-    console.log(`[Worker Pairing] Aguardando o módulo Store.PairingCode do WhatsApp Web inicializar no navegador...`);
-    for (let attempt = 1; attempt <= 15; attempt++) {
-      try {
-        const page = (this.client as any).pupPage;
-        if (page && !page.isClosed()) {
-          const isReady = await page.evaluate(() => {
-            return typeof (window as any).Store?.PairingCode?.requestPairingCode === 'function';
-          });
-          if (isReady) {
-            console.log(`[Worker Pairing] Módulo Store.PairingCode pronto no navegador após ${attempt * 800}ms.`);
-            return true;
-          }
-
```

### Commit 42: `b97ac20` — fix(worker): add triggerPairingCodeUI to force Webpack injection of PairingCodeLinkUtils and simulate canvas button click

- **Hash Completo**: `b97ac2042ff1bbaef08472d28783de7b1b6eeb48`
- **Data**: Mon Jul 27 19:35:36 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): add triggerPairingCodeUI to force Webpack injection of PairingCodeLinkUtils and simulate canvas button click`
- **Resumo das Alterações (git stat)**:
```text
b97ac20 fix(worker): add triggerPairingCodeUI to force Webpack injection of PairingCodeLinkUtils and simulate canvas button click
 apps/worker/src/whatsapp.ts | 41 ++++++++++++++++++++++++++++++++++++++++-
 1 file changed, 40 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `b97ac20` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 19:35.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit b97ac2042ff1bbaef08472d28783de7b1b6eeb48
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 19:35:36 2026 -0300

    fix(worker): add triggerPairingCodeUI to force Webpack injection of PairingCodeLinkUtils and simulate canvas button click

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index 074864b..47dd727 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -98,13 +98,52 @@ export class WhatsAppWorker {
     return this.running;
   }
 
+  private async triggerPairingCodeUI(): Promise<void> {
+    try {
+      const page = (this.client as any).pupPage;
+      if (page && !page.isClosed()) {
+        await page.evaluate(() => {
+          // 1. Tenta injetar o módulo Webpack PairingCodeLinkUtils diretamente na memória da Store
+          if ((window as any).require) {
+            try {
+              const mod = (window as any).require('WAWebPairingCodeLinkUtils') || (window as any).require('PairingCodeLinkUtils');
+              if (mod && (window as any).Store) {
+                (window as any).Store.PairingCodeLinkUtils = mod;
+              }
+            } catch (e) {}
+          }
+          // 2. Se o b
```

### Commit 43: `0971002` — fix(worker): evaluate DOM directly via pupPage.evaluate for pairing code generation to prevent undefined method errors

- **Hash Completo**: `0971002df92dcc7cc438dd622e30cdf8bd0cfa63`
- **Data**: Mon Jul 27 19:40:48 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): evaluate DOM directly via pupPage.evaluate for pairing code generation to prevent undefined method errors`
- **Resumo das Alterações (git stat)**:
```text
0971002 fix(worker): evaluate DOM directly via pupPage.evaluate for pairing code generation to prevent undefined method errors
 apps/worker/src/whatsapp.ts | 115 +++++++++++++++++++++++++++-----------------
 1 file changed, 70 insertions(+), 45 deletions(-)
```
- **Fact**: O commit `0971002` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 19:40.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 0971002df92dcc7cc438dd622e30cdf8bd0cfa63
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 19:40:48 2026 -0300

    fix(worker): evaluate DOM directly via pupPage.evaluate for pairing code generation to prevent undefined method errors

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index 47dd727..bd307c3 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -98,21 +98,21 @@ export class WhatsAppWorker {
     return this.running;
   }
 
-  private async triggerPairingCodeUI(): Promise<void> {
-    try {
-      const page = (this.client as any).pupPage;
-      if (page && !page.isClosed()) {
+  private async executePairingCodeWithRetry(phoneNumber: string): Promise<string> {
+    const cleanPhone = phoneNumber.replace(/\D/g, '');
+    const page = (this.client as any).pupPage;
+
+    if (!page || page.isClosed()) {
+      throw new Error('Navegador Chromium não está aberto para pareamento.');
+    }
+
+    // Loop de até 10 tentativas com intervalo de 1.2s
+    for (let attempt = 1; attempt <= 10; attempt++) {
+      try {
+        console.log(`[Worker Pairing] Solicitando Código de Pareamento via DOM (tentativa ${
```

### Commit 44: `dd8387f` — fix(worker): restore clean native client.requestPairingCode with 2s stabilization retry loop

- **Hash Completo**: `dd8387f137ebb57b0a51a642f86b7773b01d3bbc`
- **Data**: Mon Jul 27 19:47:09 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): restore clean native client.requestPairingCode with 2s stabilization retry loop`
- **Resumo das Alterações (git stat)**:
```text
dd8387f fix(worker): restore clean native client.requestPairingCode with 2s stabilization retry loop
 apps/worker/src/whatsapp.ts | 105 +++++---------------------------------------
 1 file changed, 12 insertions(+), 93 deletions(-)
```
- **Fact**: O commit `dd8387f` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 19:47.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit dd8387f137ebb57b0a51a642f86b7773b01d3bbc
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 19:47:09 2026 -0300

    fix(worker): restore clean native client.requestPairingCode with 2s stabilization retry loop

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index bd307c3..cff5df3 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -100,107 +100,26 @@ export class WhatsAppWorker {
 
   private async executePairingCodeWithRetry(phoneNumber: string): Promise<string> {
     const cleanPhone = phoneNumber.replace(/\D/g, '');
-    const page = (this.client as any).pupPage;
 
-    if (!page || page.isClosed()) {
-      throw new Error('Navegador Chromium não está aberto para pareamento.');
-    }
+    // Aguarda 1.5s inicial para o WhatsApp Web estabilizar a página no Chromium
+    await new Promise((resolve) => setTimeout(resolve, 1500));
 
-    // Loop de até 10 tentativas com intervalo de 1.2s
-    for (let attempt = 1; attempt <= 10; attempt++) {
+    for (let attempt = 1; attempt <= 6; attempt++) {
       try {
-        console.log(`[Worker Pairing] Solicitando Código de Pareamento via DOM (tentativa ${attempt}/10
```

### Commit 45: `f768b12` — fix(worker): automatically test both national (11-digit) and international (13-digit) phone formats for pairing code generation

- **Hash Completo**: `f768b12928e7b982f5450f8806792ff12f01d8ca`
- **Data**: Mon Jul 27 20:07:26 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): automatically test both national (11-digit) and international (13-digit) phone formats for pairing code generation`
- **Resumo das Alterações (git stat)**:
```text
f768b12 fix(worker): automatically test both national (11-digit) and international (13-digit) phone formats for pairing code generation
 apps/worker/src/whatsapp.ts | 39 +++++++++++++++++++++++++++------------
 1 file changed, 27 insertions(+), 12 deletions(-)
```
- **Fact**: O commit `f768b12` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 20:07.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit f768b12928e7b982f5450f8806792ff12f01d8ca
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 20:07:26 2026 -0300

    fix(worker): automatically test both national (11-digit) and international (13-digit) phone formats for pairing code generation

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index cff5df3..562f0bc 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -99,24 +99,39 @@ export class WhatsAppWorker {
   }
 
   private async executePairingCodeWithRetry(phoneNumber: string): Promise<string> {
-    const cleanPhone = phoneNumber.replace(/\D/g, '');
+    const rawPhone = phoneNumber.replace(/\D/g, '');
+
+    // Monta a lista de formatos (nacional sem 55 e internacional com 55)
+    const formatsToTry: string[] = [];
+    if (rawPhone.length === 11) {
+      formatsToTry.push(rawPhone); // ex: 19983648849
+      formatsToTry.push(`55${rawPhone}`); // ex: 5519983648849
+    } else if (rawPhone.startsWith('55') && rawPhone.length === 13) {
+      formatsToTry.push(rawPhone); // ex: 5519983648849
+      formatsToTry.push(rawPhone.slice(2)); // ex: 19983648849
+    } else {
+      formatsToTry.push(rawPhone);
```

### Commit 46: `6cd0691` — fix(anti-ban): cap max pairing code retries to 3 per format with 2s cooldown for IP reputation protection

- **Hash Completo**: `6cd0691e5b343b99dc70f4b3cd205deca7ece652`
- **Data**: Mon Jul 27 20:10:26 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(anti-ban): cap max pairing code retries to 3 per format with 2s cooldown for IP reputation protection`
- **Resumo das Alterações (git stat)**:
```text
6cd0691 fix(anti-ban): cap max pairing code retries to 3 per format with 2s cooldown for IP reputation protection
 apps/worker/src/whatsapp.ts | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
```
- **Fact**: O commit `6cd0691` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 20:10.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 6cd0691e5b343b99dc70f4b3cd205deca7ece652
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 20:10:26 2026 -0300

    fix(anti-ban): cap max pairing code retries to 3 per format with 2s cooldown for IP reputation protection

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index 562f0bc..999fd87 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -118,9 +118,9 @@ export class WhatsAppWorker {
     await new Promise((resolve) => setTimeout(resolve, 1500));
 
     for (const phoneCandidate of formatsToTry) {
-      for (let attempt = 1; attempt <= 4; attempt++) {
+      for (let attempt = 1; attempt <= 3; attempt++) {
         try {
-          console.log(`[Worker Pairing] Solicitando Código de Pareamento (formato: ${phoneCandidate}, tentativa ${attempt}/4)...`);
+          console.log(`[Worker Pairing] Solicitando Código de Pareamento (formato: ${phoneCandidate}, tentativa ${attempt}/3)...`);
           const code = await (this.client as any).requestPairingCode(phoneCandidate);
           if (code && typeof code === 'string' && code.length >= 6) {
             console.log(`[Worker Pairing] ✨ Código de Pareamento ger
```

### Commit 47: `9afb450` — fix(worker): purge stale/corrupted IndexedDB cache files for unauthenticated tenants to fix invariant #56367

- **Hash Completo**: `9afb450e674b8119e14650f6c0a49261e00bfb19`
- **Data**: Mon Jul 27 20:13:36 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): purge stale/corrupted IndexedDB cache files for unauthenticated tenants to fix invariant #56367`
- **Resumo das Alterações (git stat)**:
```text
9afb450 fix(worker): purge stale/corrupted IndexedDB cache files for unauthenticated tenants to fix invariant #56367
 apps/worker/src/whatsapp.ts | 23 +++++++++++++++++++++++
 1 file changed, 23 insertions(+)
```
- **Fact**: O commit `9afb450` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 20:13.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 9afb450e674b8119e14650f6c0a49261e00bfb19
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 20:13:36 2026 -0300

    fix(worker): purge stale/corrupted IndexedDB cache files for unauthenticated tenants to fix invariant #56367

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index 999fd87..527cbed 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -20,6 +20,24 @@ function getWindowsChromePath(): string | null {
   return null;
 }
 
+function cleanUnauthenticatedSessionDir(tenantId: string): void {
+  try {
+    const authDataPath = process.env.WWEBJS_AUTH_PATH || path.resolve(process.cwd(), '.wwebjs_auth');
+    const sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);
+
+    if (fs.existsSync(sessionDir)) {
+      // Se não há arquivo de autenticação preservado, removemos os dados temporários de IndexedDB corrompidos
+      const hasSavedAuth = fs.existsSync(path.join(sessionDir, 'session')) || fs.existsSync(path.join(sessionDir, 'Default', 'Service Worker'));
+      if (!hasSavedAuth) {
+        console.log(`[Worker] Limpando dados de armazenamento temporários (IndexedDB) em: ${sessionDir}`);
+
```

### Commit 48: `adb5ab7` — fix: implement WhatsApp worker class with session management and pairing code support

- **Hash Completo**: `adb5ab7a75b87575d6fba61bc6875d3d9ad15196`
- **Data**: Mon Jul 27 20:31:36 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix: implement WhatsApp worker class with session management and pairing code support`
- **Resumo das Alterações (git stat)**:
```text
adb5ab7 fix: implement WhatsApp worker class with session management and pairing code support
 apps/worker/src/index.ts    | 13 ++++++++++++
 apps/worker/src/whatsapp.ts | 52 +++++++++++++++++++++++++++++++++++++++------
 2 files changed, 58 insertions(+), 7 deletions(-)
```
- **Fact**: O commit `adb5ab7` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 20:31.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit adb5ab7a75b87575d6fba61bc6875d3d9ad15196
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 20:31:36 2026 -0300

    fix: implement WhatsApp worker class with session management and pairing code support

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index 7ae7687..9699c5c 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -107,6 +107,19 @@ async function main() {
         }
 
         if (session.status === 'DISCONNECTED_NEED_QR' || session.status === 'CONNECTED' || session.status === 'DISCONNECTED') {
+          const existingWorker = activeWorkers.get(session.tenant_id);
+          if (
+            existingWorker &&
+            session.status === 'DISCONNECTED_NEED_QR' &&
+            session.qr_code === null &&
+            session.pairing_code === null &&
+            !session.phone_number
+          ) {
+            console.log(`[Orchestrator] Redefinição de sessão solicitada para tenant ${session.tenant_id}. Reiniciando worker do zero...`);
+            await existingWorker.restartForFreshAuth(session.phone_number);
+            return;
+          }
+
           await startWorkerForTenant(session.tenant_id, sessio
```

### Commit 49: `055854c` — backup: versao estavel da autenticacao whatsapp com expurgo de sessao e pareamento por telefone sob demanda

- **Hash Completo**: `055854c2716e2a8c2465798f39ac4a5d7abbd926`
- **Data**: Mon Jul 27 21:05:06 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `backup: versao estavel da autenticacao whatsapp com expurgo de sessao e pareamento por telefone sob demanda`
- **Resumo das Alterações (git stat)**:
```text
055854c backup: versao estavel da autenticacao whatsapp com expurgo de sessao e pareamento por telefone sob demanda
 apps/worker/src/index.ts    |   5 +-
 apps/worker/src/whatsapp.ts | 137 ++++++++++++++++++++++++++------------------
 2 files changed, 84 insertions(+), 58 deletions(-)
```
- **Fact**: O commit `055854c` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Mon Jul 27 21:05.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 055854c2716e2a8c2465798f39ac4a5d7abbd926
Author: MachareteL <macharetelucas@gmail.com>
Date:   Mon Jul 27 21:05:06 2026 -0300

    backup: versao estavel da autenticacao whatsapp com expurgo de sessao e pareamento por telefone sob demanda

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index 9699c5c..3ba6009 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -106,7 +106,7 @@ async function main() {
           return;
         }
 
-        if (session.status === 'DISCONNECTED_NEED_QR' || session.status === 'CONNECTED' || session.status === 'DISCONNECTED') {
+        if (session.status === 'DISCONNECTED_NEED_QR' || session.status === 'CONNECTED') {
           const existingWorker = activeWorkers.get(session.tenant_id);
           if (
             existingWorker &&
@@ -121,6 +121,9 @@ async function main() {
           }
 
           await startWorkerForTenant(session.tenant_id, session.id, true, session.phone_number);
+        } else if (session.status === 'DISCONNECTED') {
+          console.log(`[Orchestrator] Sessão desconectada/pausada para tenant ${session.tenant_id}. Encerrando worker inativo...`);
+          await stopWorkerForTen
```

### Commit 50: `e32f624` — fix(worker): prevent destroying active workers, listen to message and message_create with deduplication, and protect session directories

- **Hash Completo**: `e32f6248c877f3187377083894d9615b9b15fcc8`
- **Data**: Tue Jul 28 10:38:07 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): prevent destroying active workers, listen to message and message_create with deduplication, and protect session directories`
- **Resumo das Alterações (git stat)**:
```text
e32f624 fix(worker): prevent destroying active workers, listen to message and message_create with deduplication, and protect session directories
 apps/worker/src/index.ts    | 39 +++++++++++++++-------
 apps/worker/src/whatsapp.ts | 79 +++++++++++++--------------------------------
 2 files changed, 51 insertions(+), 67 deletions(-)
```
- **Fact**: O commit `e32f624` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Tue Jul 28 10:38.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit e32f6248c877f3187377083894d9615b9b15fcc8
Author: MachareteL <macharetelucas@gmail.com>
Date:   Tue Jul 28 10:38:07 2026 -0300

    fix(worker): prevent destroying active workers, listen to message and message_create with deduplication, and protect session directories

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index 3ba6009..c433900 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -51,26 +51,33 @@ async function main() {
     }
   };
 
-  // 1. Carrega APENAS sessões com status CONNECTED no boot para economizar RAM/CPU da VM
+  // 1. Carrega todas as sessões com is_active = true no boot
   const { data: activeSessions, error: bootErr } = await supabase
     .from('whatsapp_sessions')
     .select('*')
-    .eq('is_active', true)
-    .eq('status', 'CONNECTED');
+    .eq('is_active', true);
 
   if (bootErr) {
     console.error('[Orchestrator] Erro ao carregar sessões no boot:', bootErr);
   }
 
   if (activeSessions && activeSessions.length > 0) {
-    console.log(`[Orchestrator] 🚀 Inicializando ${activeSessions.length} sessões de WhatsApp conectadas no boot.`);
+    console.log(`[Orchestrator] 🚀 Verificando ${activeSessions.leng
```

### Commit 51: `a8afe3b` — fix(worker): import fs module in index.ts for clean compilation

- **Hash Completo**: `a8afe3b4a7a03ca207b06c1c2778c67ff9e9a1c0`
- **Data**: Tue Jul 28 10:38:42 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): import fs module in index.ts for clean compilation`
- **Resumo das Alterações (git stat)**:
```text
a8afe3b fix(worker): import fs module in index.ts for clean compilation
 apps/worker/src/index.ts | 1 +
 1 file changed, 1 insertion(+)
```
- **Fact**: O commit `a8afe3b` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Tue Jul 28 10:38.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit a8afe3b4a7a03ca207b06c1c2778c67ff9e9a1c0
Author: MachareteL <macharetelucas@gmail.com>
Date:   Tue Jul 28 10:38:42 2026 -0300

    fix(worker): import fs module in index.ts for clean compilation

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index c433900..1741214 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -1,5 +1,6 @@
 import dotenv from 'dotenv';
 import path from 'path';
+import fs from 'fs';
 import { createSupabaseClient } from '@velox/database';
 import { WhatsAppWorker } from './whatsapp';
```

### Commit 52: `6ca689e` — fix(logs): silence group/status messages and enforce strict 8/8 cap for unauthenticated QR loops

- **Hash Completo**: `6ca689e837d47285e557bde26938a26bed2f7eb6`
- **Data**: Tue Jul 28 11:22:09 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(logs): silence group/status messages and enforce strict 8/8 cap for unauthenticated QR loops`
- **Resumo das Alterações (git stat)**:
```text
6ca689e fix(logs): silence group/status messages and enforce strict 8/8 cap for unauthenticated QR loops
 apps/worker/src/whatsapp.ts | 34 +++++++++++++++++++++++++++-------
 1 file changed, 27 insertions(+), 7 deletions(-)
```
- **Fact**: O commit `6ca689e` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Tue Jul 28 11:22.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 6ca689e837d47285e557bde26938a26bed2f7eb6
Author: MachareteL <macharetelucas@gmail.com>
Date:   Tue Jul 28 11:22:09 2026 -0300

    fix(logs): silence group/status messages and enforce strict 8/8 cap for unauthenticated QR loops

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index 5f74b4b..c815a5b 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -251,14 +251,30 @@ export class WhatsAppWorker {
   private setupListeners(): void {
     // Evento de geração de autenticação (QR Code ou Pairing Code)
     this.client.on('qr', async (qrText: string) => {
+      // Se a sessão já está autenticada, ignora qualquer evento residual de QR code
+      if (this.client.info && this.client.info.wid) return;
+
       this.qrCount++;
-      console.log(`[Worker] Geração de autenticação #${this.qrCount}/${this.maxQrAttempts} recebida para tenant ${this.tenantId}`);
 
       if (this.qrCount > this.maxQrAttempts) {
-        console.warn(`[Worker Anti-Spam] Limite de renovações de QR Code atingido (${this.qrCount}/${this.maxQrAttempts}) para tenant ${this.tenantId}. Pausando envio de novos QR codes para o banco...`);
+        if (this.qrCount
```

### Commit 53: `1808578` — fix(scraper): prioritize form input extraction over full page body text checks to prevent false positive non-retryable errors

- **Hash Completo**: `1808578c893abe6f13dc3e01c14eba846b305a71`
- **Data**: Wed Jul 29 10:12:18 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(scraper): prioritize form input extraction over full page body text checks to prevent false positive non-retryable errors`
- **Resumo das Alterações (git stat)**:
```text
1808578 fix(scraper): prioritize form input extraction over full page body text checks to prevent false positive non-retryable errors
 apps/worker/src/index.ts    | 127 +++++++---
 apps/worker/src/scraper.ts  |  31 ++-
 apps/worker/src/whatsapp.ts | 600 +++++++++++++++++++++++++++++++-------------
 3 files changed, 539 insertions(+), 219 deletions(-)
```
- **Fact**: O commit `1808578` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 10:12.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 1808578c893abe6f13dc3e01c14eba846b305a71
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 10:12:18 2026 -0300

    fix(scraper): prioritize form input extraction over full page body text checks to prevent false positive non-retryable errors

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index 1741214..b57a9fc 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -20,35 +20,67 @@ async function main() {
 
   const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   const activeWorkers = new Map<string, WhatsAppWorker>();
-
-  const startWorkerForTenant = async (tenantId: string, sessionId: string, isActive: boolean, phoneNumber?: string | null) => {
-    let worker = activeWorkers.get(tenantId);
-    if (worker && worker.isRunning()) {
-      worker.setIsActive(isActive);
-      if (phoneNumber && phoneNumber !== worker.getPhoneNumber()) {
-        await worker.requestPairingCodeOnDemand(phoneNumber);
-      }
+  const tenantLocks = new Map<string, boolean>();
+
+  const startWorkerForTenant = async (
+    tenantId: string,
+    sessionId: string,
+    isActive: boolean,
+    phoneNumber?: string | null
+
```

### Commit 54: `6419126` — fix(scraper): eliminate false positive success reports by strictly validating GET and POST response bodies for 'already accepted' messages

- **Hash Completo**: `64191269b994cb98dccc833fd33e6da0ae397032`
- **Data**: Wed Jul 29 10:19:44 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(scraper): eliminate false positive success reports by strictly validating GET and POST response bodies for 'already accepted' messages`
- **Resumo das Alterações (git stat)**:
```text
6419126 fix(scraper): eliminate false positive success reports by strictly validating GET and POST response bodies for 'already accepted' messages
 apps/worker/src/scraper.ts | 52 ++++++++++++++++++++++++++++------------------
 1 file changed, 32 insertions(+), 20 deletions(-)
```
- **Fact**: O commit `6419126` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 10:19.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 64191269b994cb98dccc833fd33e6da0ae397032
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 10:19:44 2026 -0300

    fix(scraper): eliminate false positive success reports by strictly validating GET and POST response bodies for 'already accepted' messages

diff --git a/apps/worker/src/scraper.ts b/apps/worker/src/scraper.ts
index ed09bc1..32a7708 100644
--- a/apps/worker/src/scraper.ts
+++ b/apps/worker/src/scraper.ts
@@ -124,6 +124,20 @@ export class VeloxScraper {
         const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
         debugInfo.bodyTextSnippet = bodyText.slice(0, 600);
 
+        // CHECAGEM ESTRITA NO GET: Se o HTML contiver avisos explícitos de recusa/já aceito, cancela imediatamente!
+        if (bodyText.includes('Convite já aceito por outro prestador') || bodyText.includes('ja aceito por outro prestador')) {
+          console.warn(`[Scraper] 🛑 Velox informou no HTML GET: "Convite já aceito por outro prestador"`);
+          throw new NonRetryableError('Convite já aceito por outro prestador!');
+        }
+        if (bodyText.includes('Convite expirado') || bodyText.includes('Convite encerrado') || bodyText.includes('Convite ca
```

### Commit 55: `d8ab404` — fix(logging): print exact error message, page title, and HTML snippet when scraper cancels without retry

- **Hash Completo**: `d8ab404a523f5ef3f6ace55e8e0306b473044125`
- **Data**: Wed Jul 29 10:24:30 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(logging): print exact error message, page title, and HTML snippet when scraper cancels without retry`
- **Resumo das Alterações (git stat)**:
```text
d8ab404 fix(logging): print exact error message, page title, and HTML snippet when scraper cancels without retry
 apps/worker/src/scraper.ts | 4 +++-
 1 file changed, 3 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `d8ab404` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 10:24.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit d8ab404a523f5ef3f6ace55e8e0306b473044125
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 10:24:30 2026 -0300

    fix(logging): print exact error message, page title, and HTML snippet when scraper cancels without retry

diff --git a/apps/worker/src/scraper.ts b/apps/worker/src/scraper.ts
index 32a7708..da06c03 100644
--- a/apps/worker/src/scraper.ts
+++ b/apps/worker/src/scraper.ts
@@ -341,7 +341,9 @@ export class VeloxScraper {
         if (debugInfo.getStatusCode) console.error(`          • HTTP GET Status: ${debugInfo.getStatusCode}`);
 
         if (error instanceof NonRetryableError || (error.message && error.message.includes('já aceito'))) {
-          console.log(`[Scraper] 🛑 Convite encerrado/indisponível no Velox. Cancelando tentativas sem retry.`);
+          console.log(`[Scraper] 🛑 CANCELADO SEM RETRY: ${error.message}`);
+          if (debugInfo.pageTitle) console.log(`          • Título da Página: "${debugInfo.pageTitle}"`);
+          if (debugInfo.bodyTextSnippet) console.log(`          • Trecho do HTML lido: "${debugInfo.bodyTextSnippet.slice(0, 250)}"`);
           console.log(`===============================================================
```

### Commit 56: `c5fe6c3` — feat(web): mover botao de acoes para a primeira coluna no feed de chamados

- **Hash Completo**: `c5fe6c3f46a8b5b119bd1979aed65c5820367f92`
- **Data**: Wed Jul 29 12:43:07 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(web): mover botao de acoes para a primeira coluna no feed de chamados`
- **Resumo das Alterações (git stat)**:
```text
c5fe6c3 feat(web): mover botao de acoes para a primeira coluna no feed de chamados
 apps/web/components/CallsFeed.tsx | 34 ++++++++++++++++++----------------
 1 file changed, 18 insertions(+), 16 deletions(-)
```
- **Fact**: O commit `c5fe6c3` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 12:43.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit c5fe6c3f46a8b5b119bd1979aed65c5820367f92
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 12:43:07 2026 -0300

    feat(web): mover botao de acoes para a primeira coluna no feed de chamados

diff --git a/apps/web/components/CallsFeed.tsx b/apps/web/components/CallsFeed.tsx
index 16ee00d..fac153d 100644
--- a/apps/web/components/CallsFeed.tsx
+++ b/apps/web/components/CallsFeed.tsx
@@ -168,13 +168,13 @@ export function CallsFeed({ calls, onRefreshCalls }: CallsFeedProps) {
           <table className="w-full text-left text-sm">
             <thead className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-950/80 border-b border-gray-800/80">
               <tr>
-                <th className="py-3 px-4 rounded-l-lg">Status</th>
+                <th className="py-3 px-4 rounded-l-lg">Ação</th>
+                <th className="py-3 px-4">Status</th>
                 <th className="py-3 px-4">Veículo Alocado</th>
                 <th className="py-3 px-4">Tempo de Aceite</th>
                 <th className="py-3 px-4">Prévia (Chegada)</th>
                 <th className="py-3 px-4">Link do Convite</th>
-                <th className="py-3 px-4">Horário<
```

### Commit 57: `d390a81` — feat(worker): add duplicate call detection based on ChaveConvite to prevent extra vehicle capacity consumption

- **Hash Completo**: `d390a8145d0c0d7e18307aa400a3238b3e2d67b3`
- **Data**: Wed Jul 29 13:32:24 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(worker): add duplicate call detection based on ChaveConvite to prevent extra vehicle capacity consumption`
- **Resumo das Alterações (git stat)**:
```text
d390a81 feat(worker): add duplicate call detection based on ChaveConvite to prevent extra vehicle capacity consumption
 apps/worker/src/whatsapp.ts | 139 +++++++++++++++++++++++++++++++-------------
 1 file changed, 97 insertions(+), 42 deletions(-)
```
- **Fact**: O commit `d390a81` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 13:32.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit d390a8145d0c0d7e18307aa400a3238b3e2d67b3
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 13:32:24 2026 -0300

    feat(worker): add duplicate call detection based on ChaveConvite to prevent extra vehicle capacity consumption

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index f74876b..e4a415a 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -69,6 +69,16 @@ function purgeSessionDir(tenantId: string): void {
   }
 }
 
+function extractChaveConvite(urlStr: string): string | null {
+  try {
+    const urlObj = new URL(urlStr);
+    return urlObj.searchParams.get("ChaveConvite");
+  } catch {
+    const match = urlStr.match(/ChaveConvite=([a-f0-9\-]+)/i);
+    return match ? match[1] : null;
+  }
+}
+
 export class WhatsAppWorker {
   private client!: Client;
   private scraper: VeloxScraper;
@@ -684,54 +694,97 @@ export class WhatsAppWorker {
         }
 
         try {
-          const { data: vehicles } = await this.supabase
-            .from("vehicles")
-            .select("*")
-            .eq("tenant_id", this.tenantId)
-            .eq("is_active", true);
-
-          const fleetCapacity =
-
```

### Commit 58: `7c6a6ac` — feat(worker): adicionar health check heartbeat anti-zumbi e deduplicação por ChaveConvite

- **Hash Completo**: `7c6a6accbe414c19445fc80f5fae76dc77f250c3`
- **Data**: Wed Jul 29 16:38:04 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(worker): adicionar health check heartbeat anti-zumbi e deduplicação por ChaveConvite`
- **Resumo das Alterações (git stat)**:
```text
7c6a6ac feat(worker): adicionar health check heartbeat anti-zumbi e deduplicação por ChaveConvite
 apps/worker/src/whatsapp.ts | 120 ++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 120 insertions(+)
```
- **Fact**: O commit `7c6a6ac` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 16:38.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 7c6a6accbe414c19445fc80f5fae76dc77f250c3
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 16:38:04 2026 -0300

    feat(worker): adicionar health check heartbeat anti-zumbi e deduplicação por ChaveConvite

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index e4a415a..f340d61 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -101,6 +101,10 @@ export class WhatsAppWorker {
   private reconnectTimer: NodeJS.Timeout | null = null;
   private authTimeoutTimer: NodeJS.Timeout | null = null;
 
+  // Heartbeat / Health Check anti-travamento (Zombie state)
+  private healthCheckInterval: NodeJS.Timeout | null = null;
+  private consecutiveHealthFailures: number = 0;
+
   constructor(
     private tenantId: string,
     private sessionId: string,
@@ -134,6 +138,12 @@ export class WhatsAppWorker {
         "--disable-gpu",
         "--disable-session-crashed-bubble",
         "--disable-infobars",
+        "--disable-background-timer-throttling",
+        "--disable-backgrounding-occluded-windows",
+        "--disable-renderer-backgrounding",
+        "--disable-component-update",
+        "--disable-ipc-flooding-prote
```

### Commit 59: `12eeffb` — fix(worker): limpar arquivos de trava SingletonLock ao reiniciar navegador zumbi

- **Hash Completo**: `12eeffb885a43857fcaf36d7fa6b69d6d09aa0b1`
- **Data**: Wed Jul 29 17:17:16 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): limpar arquivos de trava SingletonLock ao reiniciar navegador zumbi`
- **Resumo das Alterações (git stat)**:
```text
12eeffb fix(worker): limpar arquivos de trava SingletonLock ao reiniciar navegador zumbi
 apps/worker/src/whatsapp.ts | 41 ++++++++++++++++++++++++++++++++++++++++-
 1 file changed, 40 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `12eeffb` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 17:17.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 12eeffb885a43857fcaf36d7fa6b69d6d09aa0b1
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 17:17:16 2026 -0300

    fix(worker): limpar arquivos de trava SingletonLock ao reiniciar navegador zumbi

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index f340d61..048a33d 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -69,6 +69,44 @@ function purgeSessionDir(tenantId: string): void {
   }
 }
 
+function cleanSessionLockFiles(tenantId: string): void {
+  try {
+    const authDataPath =
+      process.env.WWEBJS_AUTH_PATH ||
+      path.resolve(process.cwd(), ".wwebjs_auth");
+    const sessionDir = path.join(authDataPath, `session-tenant_${tenantId}`);
+
+    if (!fs.existsSync(sessionDir)) return;
+
+    const lockFiles = [
+      "SingletonLock",
+      "SingletonCookie",
+      "SingletonSocket",
+      "DevToolsActivePort",
+    ];
+
+    const dirsToCheck = [sessionDir, path.join(sessionDir, "Default")];
+
+    for (const d of dirsToCheck) {
+      if (fs.existsSync(d)) {
+        for (const file of lockFiles) {
+          const filePath = path.join(d, file);
+          if (fs.existsSync(filePath)) {
+
```

### Commit 60: `c23c763` — feat(worker): auto-detectar executavel do Chromium no Linux ARM64 (Oracle Ampere)

- **Hash Completo**: `c23c763843dfed91cce3c07b9cb73d2e1a3cbf94`
- **Data**: Wed Jul 29 17:28:06 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(worker): auto-detectar executavel do Chromium no Linux ARM64 (Oracle Ampere)`
- **Resumo das Alterações (git stat)**:
```text
c23c763 feat(worker): auto-detectar executavel do Chromium no Linux ARM64 (Oracle Ampere)
 apps/worker/src/whatsapp.ts | 38 +++++++++++++++++++++++++++-----------
 1 file changed, 27 insertions(+), 11 deletions(-)
```
- **Fact**: O commit `c23c763` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 17:28.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit c23c763843dfed91cce3c07b9cb73d2e1a3cbf94
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 17:28:06 2026 -0300

    feat(worker): auto-detectar executavel do Chromium no Linux ARM64 (Oracle Ampere)

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index 048a33d..421bd11 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -11,15 +11,32 @@ import { VeloxScraper } from "./scraper";
 import { calcularPrevia } from "./calculator";
 import path from "path";
 
-function getWindowsChromePath(): string | null {
-  const paths = [
-    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
-    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
-    (process.env.LOCALAPPDATA || "") +
-      "\\Google\\Chrome\\Application\\chrome.exe",
-  ];
-  for (const p of paths) {
-    if (p && fs.existsSync(p)) return p;
+function getSystemChromePath(): string | null {
+  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
+    return process.env.PUPPETEER_EXECUTABLE_PATH;
+  }
+
+  if (process.platform === "win32") {
+    const paths = [
+      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
+      "C:\
```

### Commit 61: `680d4fd` — feat(database): adicionar script SQL cron_auto_complete.sql para finalização automatica via pg_cron

- **Hash Completo**: `680d4fdbf6b36fdf9064d50d1cafe3e8809d5792`
- **Data**: Wed Jul 29 18:16:25 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `feat(database): adicionar script SQL cron_auto_complete.sql para finalização automatica via pg_cron`
- **Resumo das Alterações (git stat)**:
```text
680d4fd feat(database): adicionar script SQL cron_auto_complete.sql para finalização automatica via pg_cron
 cron_auto_complete.sql                   | 30 ++++++++++++++++++++++++++++++
 packages/database/cron_auto_complete.sql | 30 ++++++++++++++++++++++++++++++
 2 files changed, 60 insertions(+)
```
- **Fact**: O commit `680d4fd` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 18:16.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 680d4fdbf6b36fdf9064d50d1cafe3e8809d5792
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 18:16:25 2026 -0300

    feat(database): adicionar script SQL cron_auto_complete.sql para finalização automatica via pg_cron

diff --git a/cron_auto_complete.sql b/cron_auto_complete.sql
new file mode 100644
index 0000000..c269f0f
--- /dev/null
+++ b/cron_auto_complete.sql
@@ -0,0 +1,30 @@
+-- ==============================================================================
+-- CRON JOB DE FINALIZAÇÃO AUTOMÁTICA DE ATENDIMENTOS EXPIRADOS (SUPABASE / POSTGRESQL)
+-- ==============================================================================
+-- Este script configura um job em segundo plano diretamente no banco de dados
+-- Supabase via pg_cron. Ele verifica a cada 2 minutos os chamados capturados 
+-- que excederam o tempo da prévia (previa_minutos ou 50 min padrão) e preenche
+-- a coluna completed_at com a data/hora atual.
+-- ==============================================================================
+
+-- 1. Habilita a extensão pg_cron no Supabase (se ainda não estiver ativa)
+CREATE EXTENSION IF NOT EXISTS pg_cron;
+
+-- 2. Cria ou atualiza a função que finaliza o
```

### Commit 62: `d7519e4` — chore(database): atualizar intervalo do cron_auto_complete para 5 minutos

- **Hash Completo**: `d7519e416b9501ab4508ceda57144ad8e8a43aff`
- **Data**: Wed Jul 29 18:25:15 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `chore(database): atualizar intervalo do cron_auto_complete para 5 minutos`
- **Resumo das Alterações (git stat)**:
```text
d7519e4 chore(database): atualizar intervalo do cron_auto_complete para 5 minutos
 cron_auto_complete.sql                   | 4 ++--
 packages/database/cron_auto_complete.sql | 4 ++--
 2 files changed, 4 insertions(+), 4 deletions(-)
```
- **Fact**: O commit `d7519e4` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 18:25.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit d7519e416b9501ab4508ceda57144ad8e8a43aff
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 18:25:15 2026 -0300

    chore(database): atualizar intervalo do cron_auto_complete para 5 minutos

diff --git a/cron_auto_complete.sql b/cron_auto_complete.sql
index c269f0f..d56d40b 100644
--- a/cron_auto_complete.sql
+++ b/cron_auto_complete.sql
@@ -22,9 +22,9 @@ BEGIN
 END;
 $$ LANGUAGE plpgsql;
 
--- 3. Agenda o Job no pg_cron para executar a cada 2 minutos
+-- 3. Agenda o Job no pg_cron para executar a cada 5 minutos
 SELECT cron.schedule(
     'auto-complete-expired-calls-job',
-    '*/2 * * * *',
+    '*/5 * * * *',
     $$ SELECT public.auto_complete_expired_calls(); $$
 );
diff --git a/packages/database/cron_auto_complete.sql b/packages/database/cron_auto_complete.sql
index c269f0f..d56d40b 100644
--- a/packages/database/cron_auto_complete.sql
+++ b/packages/database/cron_auto_complete.sql
@@ -22,9 +22,9 @@ BEGIN
 END;
 $$ LANGUAGE plpgsql;
 
--- 3. Agenda o Job no pg_cron para executar a cada 2 minutos
+-- 3. Agenda o Job no pg_cron para executar a cada 5 minutos
 SELECT cron.schedule(
     'auto-complete-expired-calls-job',
-    '*/2 * * * *',
+    '*/5 * * *
```

### Commit 63: `a2c89e7` — config(pm2): adicionar fuso horario TZ America/Sao_Paulo no ecosystem.config.js

- **Hash Completo**: `a2c89e7116d55de68cb142d35a096057891c12d8`
- **Data**: Wed Jul 29 18:26:43 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `config(pm2): adicionar fuso horario TZ America/Sao_Paulo no ecosystem.config.js`
- **Resumo das Alterações (git stat)**:
```text
a2c89e7 config(pm2): adicionar fuso horario TZ America/Sao_Paulo no ecosystem.config.js
 ecosystem.config.js | 3 +++
 1 file changed, 3 insertions(+)
```
- **Fact**: O commit `a2c89e7` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 18:26.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit a2c89e7116d55de68cb142d35a096057891c12d8
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 18:26:43 2026 -0300

    config(pm2): adicionar fuso horario TZ America/Sao_Paulo no ecosystem.config.js

diff --git a/ecosystem.config.js b/ecosystem.config.js
index 029c566..6ed77e7 100644
--- a/ecosystem.config.js
+++ b/ecosystem.config.js
@@ -5,6 +5,9 @@ module.exports = {
       script: 'apps/worker/dist/index.js',
       log_date_format: 'YYYY-MM-DD HH:mm:ss',
       time: true,
+      env: {
+        TZ: 'America/Sao_Paulo',
+      },
     },
   ],
 };
```

### Commit 64: `1dda24c` — fix(pm2): adicionar SYSTEMD_IGNORE_CHROOT e DBUS_SESSION_BUS_ADDRESS para liberar Snap Chromium no PM2

- **Hash Completo**: `1dda24c851f9d1cff985424ec61f09da76a0eeb6`
- **Data**: Wed Jul 29 22:05:06 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(pm2): adicionar SYSTEMD_IGNORE_CHROOT e DBUS_SESSION_BUS_ADDRESS para liberar Snap Chromium no PM2`
- **Resumo das Alterações (git stat)**:
```text
1dda24c fix(pm2): adicionar SYSTEMD_IGNORE_CHROOT e DBUS_SESSION_BUS_ADDRESS para liberar Snap Chromium no PM2
 ecosystem.config.js | 2 ++
 1 file changed, 2 insertions(+)
```
- **Fact**: O commit `1dda24c` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Wed Jul 29 22:05.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 1dda24c851f9d1cff985424ec61f09da76a0eeb6
Author: MachareteL <macharetelucas@gmail.com>
Date:   Wed Jul 29 22:05:06 2026 -0300

    fix(pm2): adicionar SYSTEMD_IGNORE_CHROOT e DBUS_SESSION_BUS_ADDRESS para liberar Snap Chromium no PM2

diff --git a/ecosystem.config.js b/ecosystem.config.js
index 6ed77e7..6eb9665 100644
--- a/ecosystem.config.js
+++ b/ecosystem.config.js
@@ -7,6 +7,8 @@ module.exports = {
       time: true,
       env: {
         TZ: 'America/Sao_Paulo',
+        SYSTEMD_IGNORE_CHROOT: '1',
+        DBUS_SESSION_BUS_ADDRESS: '/dev/null',
       },
     },
   ],
```

### Commit 65: `3424c85` — fix(worker): adicionar loop de auto-recuperacao/retry ao falhar abertura do Chromium e repassar envs no Puppeteer

- **Hash Completo**: `3424c85e2e041d1af5501ad8773b2d4e5d6bc083`
- **Data**: Thu Jul 30 09:50:07 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): adicionar loop de auto-recuperacao/retry ao falhar abertura do Chromium e repassar envs no Puppeteer`
- **Resumo das Alterações (git stat)**:
```text
3424c85 fix(worker): adicionar loop de auto-recuperacao/retry ao falhar abertura do Chromium e repassar envs no Puppeteer
 apps/worker/src/index.ts    | 15 ++++++++++++++-
 apps/worker/src/whatsapp.ts | 21 +++++++++++++++++++++
 2 files changed, 35 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `3424c85` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 30 09:50.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 3424c85e2e041d1af5501ad8773b2d4e5d6bc083
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 30 09:50:07 2026 -0300

    fix(worker): adicionar loop de auto-recuperacao/retry ao falhar abertura do Chromium e repassar envs no Puppeteer

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index b57a9fc..705ad18 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -34,8 +34,9 @@ async function main() {
     }
     tenantLocks.set(tenantId, true);
 
+    let worker: WhatsAppWorker | undefined = activeWorkers.get(tenantId);
+
     try {
-      let worker = activeWorkers.get(tenantId);
       if (worker && worker.isRunning()) {
         worker.setIsActive(isActive);
         if (phoneNumber && phoneNumber !== worker.getPhoneNumber()) {
@@ -61,6 +62,18 @@ async function main() {
       await worker.start();
     } catch (err: any) {
       console.error(`[Orchestrator] Erro ao iniciar worker para tenant ${tenantId}:`, err?.message);
+      if (worker) {
+        try {
+          await worker.stop();
+        } catch (_) {}
+        activeWorkers.delete(tenantId);
+      }
+      if (isActive) {
+        console.log(`[Orchestrator] Agendando
```

### Commit 66: `e1b82b4` — fix(worker): filtrar e rejeitar executaveis do Chromium vinculados ao Snap no Linux

- **Hash Completo**: `e1b82b4da6ce84df87de6f469c317eb540000a67`
- **Data**: Thu Jul 30 10:22:11 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): filtrar e rejeitar executaveis do Chromium vinculados ao Snap no Linux`
- **Resumo das Alterações (git stat)**:
```text
e1b82b4 fix(worker): filtrar e rejeitar executaveis do Chromium vinculados ao Snap no Linux
 apps/worker/src/whatsapp.ts | 20 ++++++++++++++++----
 1 file changed, 16 insertions(+), 4 deletions(-)
```
- **Fact**: O commit `e1b82b4` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 30 10:22.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit e1b82b4da6ce84df87de6f469c317eb540000a67
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 30 10:22:11 2026 -0300

    fix(worker): filtrar e rejeitar executaveis do Chromium vinculados ao Snap no Linux

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index da18e83..af25c29 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -28,14 +28,26 @@ function getSystemChromePath(): string | null {
     }
   } else {
     const paths = [
+      "/usr/bin/google-chrome-stable",
+      "/usr/bin/google-chrome",
       "/usr/bin/chromium-browser",
       "/usr/bin/chromium",
-      "/usr/bin/google-chrome",
-      "/usr/bin/google-chrome-stable",
-      "/snap/bin/chromium",
     ];
     for (const p of paths) {
-      if (p && fs.existsSync(p)) return p;
+      if (p && fs.existsSync(p)) {
+        try {
+          const realPath = fs.realpathSync(p);
+          if (!realPath.includes("/snap/")) {
+            return p;
+          } else {
+            console.warn(
+              `[Worker] Ignorando executável em "${p}" pois aponta para Snap ("${realPath}"). O Snap é bloqueado pelo PM2 systemd service.`,
+            );
+
```

### Commit 67: `ea0628d` — fix(worker): validar e desconsiderar PUPPETEER_EXECUTABLE_PATH inexistente ou vinculado ao Snap

- **Hash Completo**: `ea0628d4f69259989150032ba492fcb13e6dbab7`
- **Data**: Thu Jul 30 10:26:45 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): validar e desconsiderar PUPPETEER_EXECUTABLE_PATH inexistente ou vinculado ao Snap`
- **Resumo das Alterações (git stat)**:
```text
ea0628d fix(worker): validar e desconsiderar PUPPETEER_EXECUTABLE_PATH inexistente ou vinculado ao Snap
 apps/worker/src/whatsapp.ts | 20 +++++++++++++++++++-
 1 file changed, 19 insertions(+), 1 deletion(-)
```
- **Fact**: O commit `ea0628d` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 30 10:26.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit ea0628d4f69259989150032ba492fcb13e6dbab7
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 30 10:26:45 2026 -0300

    fix(worker): validar e desconsiderar PUPPETEER_EXECUTABLE_PATH inexistente ou vinculado ao Snap

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index af25c29..1c0a193 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -13,7 +13,25 @@ import path from "path";
 
 function getSystemChromePath(): string | null {
   if (process.env.PUPPETEER_EXECUTABLE_PATH) {
-    return process.env.PUPPETEER_EXECUTABLE_PATH;
+    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
+    if (fs.existsSync(envPath)) {
+      try {
+        const realPath = fs.realpathSync(envPath);
+        if (!realPath.includes("/snap/")) {
+          return envPath;
+        } else {
+          console.warn(
+            `[Worker] Ignorando PUPPETEER_EXECUTABLE_PATH em "${envPath}" pois aponta para Snap ("${realPath}").`,
+          );
+        }
+      } catch {
+        if (!envPath.includes("/snap/")) return envPath;
+      }
+    } else {
+      console.warn(
+        `[Worker] PUPPETEER_EXECUTABLE_PATH definido em .env ("${e
```

### Commit 68: `82a2122` — fix(worker): detectar e ignorar scripts de atalho do Ubuntu Snap stub em /usr/bin/chromium-browser

- **Hash Completo**: `82a2122a68321aa067128d2d48b84f4e3ab14049`
- **Data**: Thu Jul 30 10:28:49 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): detectar e ignorar scripts de atalho do Ubuntu Snap stub em /usr/bin/chromium-browser`
- **Resumo das Alterações (git stat)**:
```text
82a2122 fix(worker): detectar e ignorar scripts de atalho do Ubuntu Snap stub em /usr/bin/chromium-browser
 apps/worker/src/whatsapp.ts | 52 ++++++++++++++++++++++-----------------------
 1 file changed, 26 insertions(+), 26 deletions(-)
```
- **Fact**: O commit `82a2122` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 30 10:28.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 82a2122a68321aa067128d2d48b84f4e3ab14049
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 30 10:28:49 2026 -0300

    fix(worker): detectar e ignorar scripts de atalho do Ubuntu Snap stub em /usr/bin/chromium-browser

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index 1c0a193..e62b965 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -11,25 +11,30 @@ import { VeloxScraper } from "./scraper";
 import { calcularPrevia } from "./calculator";
 import path from "path";
 
+function isUbuntuSnapStub(filePath: string): boolean {
+  try {
+    const realPath = fs.realpathSync(filePath);
+    if (realPath.includes("/snap/")) return true;
+
+    const stat = fs.statSync(filePath);
+    if (stat.isFile() && stat.size < 4096) {
+      const content = fs.readFileSync(filePath, "utf8");
+      if (content.includes("snap install") || content.includes("chromium snap")) {
+        return true;
+      }
+    }
+  } catch {}
+  return false;
+}
+
 function getSystemChromePath(): string | null {
   if (process.env.PUPPETEER_EXECUTABLE_PATH) {
     const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
-    if (fs.existsSync(envPa
```

### Commit 69: `75e2546` — perf(orchestrator): tornar a inicializacao de sessoes concorrente no boot sem bloquear o loop principal

- **Hash Completo**: `75e2546cb2323f575f62061871b5f2058a6a56cc`
- **Data**: Thu Jul 30 10:33:10 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `perf(orchestrator): tornar a inicializacao de sessoes concorrente no boot sem bloquear o loop principal`
- **Resumo das Alterações (git stat)**:
```text
75e2546 perf(orchestrator): tornar a inicializacao de sessoes concorrente no boot sem bloquear o loop principal
 apps/worker/src/index.ts | 8 +++++---
 1 file changed, 5 insertions(+), 3 deletions(-)
```
- **Fact**: O commit `75e2546` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 30 10:33.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 75e2546cb2323f575f62061871b5f2058a6a56cc
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 30 10:33:10 2026 -0300

    perf(orchestrator): tornar a inicializacao de sessoes concorrente no boot sem bloquear o loop principal

diff --git a/apps/worker/src/index.ts b/apps/worker/src/index.ts
index 705ad18..99ab3d0 100644
--- a/apps/worker/src/index.ts
+++ b/apps/worker/src/index.ts
@@ -119,9 +119,11 @@ async function main() {
         console.log(
           `[Orchestrator] Inicializando robô para tenant ${session.tenant_id} (Status DB: ${session.status}, Pasta em Disco: ${hasSessionDir})...`
         );
-        await startWorkerForTenant(session.tenant_id, session.id, session.is_active !== false, session.phone_number);
-        // Stagger de 800ms para suavizar a carga de CPU da VM durante o restart
-        await new Promise((resolve) => setTimeout(resolve, 800));
+        startWorkerForTenant(session.tenant_id, session.id, session.is_active !== false, session.phone_number).catch((err) => {
+          console.error(`[Orchestrator] Erro no boot para tenant ${session.tenant_id}:`, err?.message);
+        });
+        // Stagger de 1500ms entre as inicializações para
```

### Commit 70: `3faa000` — fix(worker): aumentar protocolTimeout do Puppeteer para 180s evitando timeout em leituras de IndexedDB no ARM64

- **Hash Completo**: `3faa0000f5c4cf1cba46feb217e20b4c023a544c`
- **Data**: Thu Jul 30 10:34:16 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): aumentar protocolTimeout do Puppeteer para 180s evitando timeout em leituras de IndexedDB no ARM64`
- **Resumo das Alterações (git stat)**:
```text
3faa000 fix(worker): aumentar protocolTimeout do Puppeteer para 180s evitando timeout em leituras de IndexedDB no ARM64
 apps/worker/src/whatsapp.ts | 1 +
 1 file changed, 1 insertion(+)
```
- **Fact**: O commit `3faa000` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 30 10:34.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 3faa0000f5c4cf1cba46feb217e20b4c023a544c
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 30 10:34:16 2026 -0300

    fix(worker): aumentar protocolTimeout do Puppeteer para 180s evitando timeout em leituras de IndexedDB no ARM64

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index e62b965..ca065c0 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -213,6 +213,7 @@ export class WhatsAppWorker {
   private createClient(): Client {
     const puppeteerConfig: any = {
       headless: "new",
+      protocolTimeout: 180000,
       args: [
         "--no-sandbox",
         "--disable-setuid-sandbox",
```

### Commit 71: `50ad027` — fix(worker): remover webVersionCache remota que travava inicializacao do WhatsApp Web no boot

- **Hash Completo**: `50ad02761325e1dc6b2c61c134600ded344385ce`
- **Data**: Thu Jul 30 10:36:35 2026 -0300
- **Autor**: MachareteL
- **Mensagem**: `fix(worker): remover webVersionCache remota que travava inicializacao do WhatsApp Web no boot`
- **Resumo das Alterações (git stat)**:
```text
50ad027 fix(worker): remover webVersionCache remota que travava inicializacao do WhatsApp Web no boot
 apps/worker/src/whatsapp.ts | 6 ++----
 1 file changed, 2 insertions(+), 4 deletions(-)
```
- **Fact**: O commit `50ad027` foi aplicado no repositório alterando os arquivos descritos acima.
- **Contexto & Dependências**: Este commit faz parte da evolução da base de código, interagindo com as estruturas vigentes na data de Thu Jul 30 10:36.
- **Impacto no Sistema**: Ajuste direcionado para melhoria de estabilidade, funcionalidade ou infraestrutura da plataforma Velox Automator.
- **Demonstração Técnica ANTES → ALTERAÇÃO → DEPOIS**:
```diff
commit 50ad02761325e1dc6b2c61c134600ded344385ce
Author: MachareteL <macharetelucas@gmail.com>
Date:   Thu Jul 30 10:36:35 2026 -0300

    fix(worker): remover webVersionCache remota que travava inicializacao do WhatsApp Web no boot

diff --git a/apps/worker/src/whatsapp.ts b/apps/worker/src/whatsapp.ts
index ca065c0..213cc51 100644
--- a/apps/worker/src/whatsapp.ts
+++ b/apps/worker/src/whatsapp.ts
@@ -212,7 +212,7 @@ export class WhatsAppWorker {
 
   private createClient(): Client {
     const puppeteerConfig: any = {
-      headless: "new",
+      headless: true,
       protocolTimeout: 180000,
       args: [
         "--no-sandbox",
@@ -256,9 +256,7 @@ export class WhatsAppWorker {
         dataPath: authDataPath,
       }),
       webVersionCache: {
-        type: "remote",
-        remotePath:
-          "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html",
+        type: "local",
       },
       puppeteer: puppeteerConfig,
     });
```

## 8. Architecture Evolution

**Fact:** O Velox Automator começou no commit `138879d` como um script monolítico local `index.js`. No commit `84d114f`, foi completamente reestruturado para uma arquitetura Monorepo desacoplada:

- **Protótipo Inicial**: `index.js` executava `whatsapp-web.js` + Puppeteer na mesma thread local de execução.
- **Arquitetura Monorepo Atual**: O frontend Next.js 14 fica hospedado na Vercel, enquanto o Orquestrador de Workers roda em instâncias de servidores Linux ARM64 gerenciadas pelo PM2.
- **Isolamento Multi-Tenant**: Cada prestador (`tenant_id`) possui seu próprio registro na tabela `tenants` e `sessions`, além de uma instância dedicada da classe `WhatsAppWorker` isolada em diretório `.wwebjs_auth/session-<tenant_id>`.

## 9. Current Architecture

```mermaid
flowchart TD
    subgraph Frontend [Apps / Web - Next.js 14]
        UI[Painel Prestador / Glassmorphism UI]
        Feed[CallsFeed Component]
        QR[QRModal Component / Pairing Code]
        Fleet[FleetManagement Component]
    end

    subgraph Database [Supabase PostgreSQL & Auth]
        Auth[Supabase Auth / RLS]
        Tenants[(Tabela tenants)]
        Sessions[(Tabela sessions)]
        Calls[(Tabela captured_calls)]
        Vehicles[(Tabela fleet_vehicles)]
    end

    subgraph WorkerService [Apps / Worker - Orquestrador]
        Orchestrator[index.ts - Worker Orchestrator Loop]
        WAWorker[WhatsAppWorker Instance por Tenant]
        Scraper[VeloxScraper - Puppeteer Engine]
    end

    UI --> Auth
    UI --> Tenants
    Feed --> Calls
    Fleet --> Vehicles
    QR --> Sessions

    Orchestrator --> Sessions
    Orchestrator --> WAWorker
    WAWorker --> Calls
    WAWorker --> Vehicles
    WAWorker --> Scraper
    Scraper --> VeloxPlatform[Plataforma Velox / Link Aceite]
```

## 10. Database Evolution

**Fact:** O banco de dados PostgreSQL é gerenciado via Supabase e seu schema oficial está consolidado em [`schema.sql`](file:///c:/Users/Lucas/Desktop/amazing-planck/schema.sql) e [`cron_auto_complete.sql`](file:///c:/Users/Lucas/Desktop/amazing-planck/cron_auto_complete.sql).

- **Evolução das Tabelas**:
  - `tenants`: Armazena os dados dos prestadores de serviço.
  - `sessions`: Guarda o estado da conexão WhatsApp (`QR_READY`, `PAIRING_CODE_READY`, `AUTHENTICATED`, `DISCONNECTED`).
  - `fleet_vehicles`: Cadastra a frota de veículos (placa, modelo, tipo de guincho, status ativo/inativo).
  - `captured_calls`: Registra cada chamado capturado, chave de convite `chave_convite`, valor, origem, status e veículo atribuído.
  - `system_logs`: Armazena logs de auditoria e diagnóstico do sistema.
- **Row Level Security (RLS)**: Habilitado em todas as tabelas com suporte a UPDATE para authenticated clients e service roles (Commit `83b74a3`).
- **pg_cron Auto-Complete**: Rotina executada a cada 5 minutos no PostgreSQL para finalizar chamados antigos automaticamente (Commits `680d4fd` e `d7519e4`).

## 11. API Evolution

**Fact:** A comunicação entre o frontend e a camada de dados é feita diretamente através do SDK do Supabase com Row Level Security. O Worker não expõe endpoints HTTP; em vez disso, consome as tabelas `sessions` e `tenants` via polling e atualizações em tempo real.

## 12. Frontend Evolution

**Fact:** O frontend em `apps/web` foi construído com Next.js 14 App Router e Tailwind CSS:

- Redesenho para estilo **Glassmorphism Moderno** no commit `34af96b`.
- Adição de modal responsivo com suporte a QR Code e **Código de Pareamento por Telefone (8 dígitos)** no commit `69ee54c`.
- Chave ON/OFF de aceites automáticos no header (`259ca57`).
- Ajuste na disposição do feed de chamados, movendo ações para a primeira coluna (`c5fe6c3`).

## 13. Backend Evolution

**Fact:** O backend em `apps/worker` evoluiu em etapas críticas de resiliência:
- Orquestração com boot stagger de 800ms entre sessões (`616c156`) e inicialização concorrente (`75e2546`).
- Injeção no WhatsApp Web para solicitar código de pareamento por número de telefone (`e1733d0` a `dd8387f`).
- Purga de cache corrompido do IndexedDB (`9afb450`) para evitar a exceção Invariant #56367 do WhatsApp Web.
- Verificação de integridade anti-zumbi e remoção de trava `SingletonLock` (`7c6a6ac`, `12eeffb`).
- Detecção e rejeição de binários do Ubuntu Snap em `/usr/bin/chromium-browser` no Linux ARM64 (`e1b82b4`, `ea0628d`, `82a2122`).
- Aumento do `protocolTimeout` do Puppeteer para 180s (`3faa000`) e remoção da trava de `webVersionCache` (`50ad027`).

## 14. Important Technical Decisions

1. **Restrição de Cadastro Público (`0cf4c3d`)**: Bloqueou-se o cadastro aberto no frontend para garantir acesso exclusivo a prestadores autorizados via Supabase Auth.
2. **Autenticação via Código de Pareamento por Telefone (`69ee54c`)**: Introduziu-se o código de pareamento de 8 dígitos para permitir conexão em dispositivos sem câmera funcional para leitura de QR Code.
3. **Deduplicação por `ChaveConvite` (`d390a81` / `7c6a6ac`)**: Evita que a mesma proposta de chamado consuma capacidade de múltiplos veículos da frota do prestador.
4. **Purga de Cache do IndexedDB (`9afb450`)**: Limpeza preventiva das pastas do IndexedDB no diretório de sessão do WhatsApp quando ocorrem falhas de autenticação, resolvendo o travamento de tela branca (Invariant #56367).
5. **Bypass de Bloqueios do Snap Chromium em Servidores Linux (`1dda24c` / `82a2122`)**: Configuração de variáveis de ambiente no PM2 (`SYSTEMD_IGNORE_CHROOT`) e filtro de verificação de `realpath` para desconsiderar a versão isolada do Snap que causa falhas sob o systemd.

## 15. Bugs and Fixes

- **React Error #310 (`54d6c8a`)**: Resolvido no `QRModal` movendo retornos precoces para após a declaração de todos os hooks do React.
- **CDP Navigation Rejection (`8fc9ae0`)**: Adicionado tratamento de erro no Puppeteer quando o contexto do Chromium é destruído durante a navegação.
- **Detached Chromium Frame (`140db31`)**: Implementada recuperação automática e reinicialização da instância de worker quando quadros de navegação ficam desanexados.
- **Zombie Worker Browser (`7c6a6ac` / `12eeffb`)**: Implementado heartbeat de verificação de saúde e remoção preventiva dos arquivos `SingletonLock` do Chromium.
- **Puppeteer Protocol Timeout no ARM64 (`3faa000`)**: Elevado o timeout de protocolo de 30s para 180s para permitir leitura pesada de IndexedDB na arquitetura ARM64.
- **Travamento em `webVersionCache` (`50ad027`)**: Removido cache de versão remota do WhatsApp Web que impedia a inicialização dos robôs em ambientes isolados.

## 16. Important Technical Flows

```text
1. Mensagem recebida no grupo do WhatsApp pelo WhatsAppWorker
   ↓
2. Extração de URL da Velox (regex match: http://velox... ou link de convite)
   ↓
3. Validação de deduplicação por ChaveConvite e checagem de capacidade na frota do prestador
   ↓
4. Execução do VeloxScraper (Puppeteer abre a página de aceite)
   ↓
5. Extração dinâmica do formulário e submissão do aceite
   ↓
6. Validação do corpo da resposta HTML (confirmação de sucesso vs 'já aceito')
   ↓
7. Registro na tabela captured_calls do Supabase com o veículo vinculado e envio de log
```

## 17. Current System Behavior

**Fact:** Atualmente, o sistema opera de forma autônoma e resiliente em produção. O Orquestrador no worker monitora continuamente a tabela `sessions`, gerenciando conexões ativas do WhatsApp e acionando o scraper Puppeteer com retry inteligente a cada convite detectado.

## 18. Code Patterns and Conventions

- Uso estrito de TypeScript em todos os aplicativos (`apps/web`, `apps/worker`) e pacotes (`packages/database`, `packages/types`).
- Tratamento defensivo de exceções em loops assíncronos de automação.
- Modularização da classe de worker [`WhatsAppWorker`](file:///c:/Users/Lucas/Desktop/amazing-planck/apps/worker/src/whatsapp.ts) e scraper [`VeloxScraper`](file:///c:/Users/Lucas/Desktop/amazing-planck/apps/worker/src/scraper.ts).
- Padronização de logs estruturados indicando o contexto do tenant `[Worker][TenantID]`.

## 19. Important Files

- [`apps/worker/src/index.ts`](file:///c:/Users/Lucas/Desktop/amazing-planck/apps/worker/src/index.ts): Ponto de entrada do Orquestrador de Workers.
- [`apps/worker/src/whatsapp.ts`](file:///c:/Users/Lucas/Desktop/amazing-planck/apps/worker/src/whatsapp.ts): Gerenciador da sessão do WhatsApp Web, pareamento por telefone e QR code.
- [`apps/worker/src/scraper.ts`](file:///c:/Users/Lucas/Desktop/amazing-planck/apps/worker/src/scraper.ts): Motor do Puppeteer para extração e aceite de ordens.
- [`apps/web/app/page.tsx`](file:///c:/Users/Lucas/Desktop/amazing-planck/apps/web/app/page.tsx): Dashboard principal do prestador.
- [`schema.sql`](file:///c:/Users/Lucas/Desktop/amazing-planck/schema.sql): DDL completo do Supabase PostgreSQL.
- [`ecosystem.config.js`](file:///c:/Users/Lucas/Desktop/amazing-planck/ecosystem.config.js): Definição dos processos PM2 para produção.

## 20. Dependencies Evolution

**Fact:** As dependências principais introduzidas e mantidas no repositório são `whatsapp-web.js`, `puppeteer`, `@supabase/supabase-js`, `next`, `react`, `lucide-react` e `tailwindcss`.

## 21. Configuration and Environment

- `NEXT_PUBLIC_SUPABASE_URL`: Endpoint da API do Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave anônima pública do Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Chave privada do service role utilizada exclusivamente pelo worker.
- `PUPPETEER_EXECUTABLE_PATH`: Caminho opcional do executável do Chromium no Linux.

## 22. Testing

**Fact:** A validação do sistema é realizada via compilação de tipos TypeScript (`npm run build`), verificação sintática e execução em ambiente de homologação no PM2.

## 23. Deployment / Infrastructure

- **Frontend**: Implantado na plataforma Vercel a partir do subdiretório `apps/web` do monorepo.
- **Worker Service**: Implantado em servidor virtual Linux ARM64 (Oracle Cloud Ampere) executando Node.js e gerenciado pelo PM2 com o arquivo `ecosystem.config.js`.

## 24. Current State

**Fact:** O projeto encontra-se em um estado maduro e altamente resiliente, com suporte completo a autenticação por código de telefone, purga de sessoes zumbis, tolerância a falhas no ecossistema Linux ARM64 e execução concorrente de trabalhadores.

## 25. Known Limitations

- **Dependência de Mudanças de Layout do WhatsApp Web**: Alterações estruturais no bundle JavaScript do WhatsApp Web podem exigir atualizações pontuais na classe `whatsapp-web.js` ou nos seletores DOM de pareamento por telefone.

## 26. Future Development Context

Futuras melhorias planejadas podem incluir suporte a múltiplas plataformas parceiras de chamados além da Velox e painel de métricas analíticas avançadas de tempo de resposta por veículo.

## 27. AI Developer Guide

> [!TIP]
> **Instruções Especiais para IAs e Novos Desenvolvedores**
> 
> 1. **Onde Começar**: Leia este arquivo `PROJECT_LIFECYCLE.md` por inteiro e em seguida inspecione os arquivos [`apps/worker/src/index.ts`](file:///c:/Users/Lucas/Desktop/amazing-planck/apps/worker/src/index.ts) e [`apps/worker/src/whatsapp.ts`](file:///c:/Users/Lucas/Desktop/amazing-planck/apps/worker/src/whatsapp.ts).
> 2. **Isolamento de Tenants**: Sempre respeite o isolamento por `tenant_id`. Nunca compartilhe diretórios de sessão `.wwebjs_auth/session-<tenant_id>` entre diferentes prestadores.
> 3. **Cuidados com Chromium no Linux ARM64**: Ao alterar opções do Puppeteer, preserve a função `getSystemChromePath()` em `whatsapp.ts` e evite remover as opções de `--no-sandbox` e suporte a `protocolTimeout` elevado.
> 4. **Hooks em Componentes React**: Em `apps/web`, certifique-se de que todos os hooks do React (`useState`, `useEffect`, `useCallback`) sejam invocados incondicionalmente no topo dos componentes antes de qualquer cláusula de `return` precoce.
> 5. **Deduplicação de Chamados**: Mantenha a checagem por `ChaveConvite` para impedir consumo indevido de slots da frota do prestador.

## 28. Complete Commit Index

| # | Commit Hash | Data | Autor | Mensagem do Commit | Categoria |
| - | ----------- | ---- | ----- | ------------------ | --------- |
| 1 | `138879d607b441280f770a9a039b92c770783d71` | Tue Jul 21 17:32 | mlc4ca | Initial commit | Commit 1 |
| 2 | `84d114f2fce82cb18619a89e0959f15e1b4003b3` | Thu Jul 23 22:21 | MachareteL | feat: migracao para TypeScript, estrutura Monorepo e integracao Supabase SaaS | Commit 2 |
| 3 | `9bee6a2bdc399a749bd4e62c4483835818627bc2` | Thu Jul 23 22:30 | MachareteL | feat: implementacao de Supabase Auth, RLS Multi-Tenant e Orquestrador de Workers | Commit 3 |
| 4 | `0cf4c3d5c1899dffe2035dabf4aec21eb4674f67` | Thu Jul 23 22:34 | MachareteL | fix: remover cadastro publico e manter apenas login restrito para prestadores | Commit 4 |
| 5 | `eaa2fcf77d51bf197642c5c5e1bbbda2d9880687` | Thu Jul 23 22:38 | MachareteL | fix: adicionar restricao UNIQUE em tenant_id e upsert seguro no QRModal e Orquestrador | Commit 5 |
| 6 | `b232393dab64bd9c6ec5d1a44e78296ed6d5590f` | Thu Jul 23 22:41 | MachareteL | fix: atualizar RLS no Supabase para permitir que o Worker acesse e atualize as sessoes em tempo real | Commit 6 |
| 7 | `ebf99dbacf6af0e6cf4e6f74eee239a4b6553f13` | Thu Jul 23 22:50 | MachareteL | docs: adicionar arquivo de script SQL completo e politicas RLS em schema.sql | Commit 7 |
| 8 | `43e0fff9846074240e029877961ad7c3bead71ad` | Thu Jul 23 22:53 | MachareteL | style: atualizar branding para Velox Automator e simplificar termos da UI | Commit 8 |
| 9 | `259ca5717d98096680ec1a27f9622af2688e955c` | Fri Jul 24 14:10 | MachareteL | feat: adicionar chave ON/OFF para ativar/pausar aceites automaticos pelo prestador | Commit 9 |
| 10 | `479033218bdda175e31a28fd56bee54462df0037` | Fri Jul 24 16:14 | MachareteL | feat: implementacao de reconexao segura Anti-Ban (Exponential Backoff) e Retry inteligente no VeloxScraper | Commit 10 |
| 11 | `d13521d21f8a28bde0a728a12da412f92f0d55f2` | Fri Jul 24 20:43 | MachareteL | feat: implementacao de Gestao de Frota simplificada, relatorio por veiculo e controle de atendimentos simultaneos | Commit 11 |
| 12 | `34af96b0e35b6285b3457f8e1f427955b794ece1` | Fri Jul 24 21:50 | MachareteL | style: redesenhar interface UX/UI do Velox Automator para padrao glassmorphism moderno, responsivo e intuitivo | Commit 12 |
| 13 | `5a513176bc4565bc306f68a067c273e92b4fba15` | Sat Jul 25 12:22 | MachareteL | feat(worker): add PUPPETEER_EXECUTABLE_PATH support for ARM64/Linux | Commit 13 |
| 14 | `514a59f0d1f55b56137f4e0c840f56b7a1318f76` | Sat Jul 25 13:11 | MachareteL | fix(vercel): build monorepo dependencies before next build and remove static fallback keys | Commit 14 |
| 15 | `474f97500c5da0ad07a3e8e34f58561f9d8df4d7` | Sat Jul 25 13:12 | MachareteL | fix(database): allow safe placeholder initialization during Next.js SSG build | Commit 15 |
| 16 | `ba8bf312404f9ac6a1a9944ed43a1b4b51d4a2e7` | Sat Jul 25 13:14 | MachareteL | fix(database): add @types/node devDependency to resolve process global | Commit 16 |
| 17 | `50609815d3a071f310263c2fa6cff83e5b9d60e8` | Sat Jul 25 13:29 | MachareteL | fix(orchestrator): stop worker when tenant/session is deleted from database | Commit 17 |
| 18 | `c7fd21952de6de2703cb9fb0c8f663c3c8cc6d07` | Sat Jul 25 21:39 | MachareteL | feat(scraper): add comprehensive diagnostic logging, multi-strategy form extraction and frontend debug inspector | Commit 18 |
| 19 | `ccd3d86539d5875dd20225e866086c4467022549` | Sat Jul 25 21:46 | MachareteL | fix(scraper): remove mandatory IdAtendimentoConvite requirement which blocked valid Velox invites | Commit 19 |
| 20 | `0b903e8868b612d2660a67de18ae2a112eee1cda` | Sun Jul 26 16:31 | MachareteL | feat: add PM2 log timestamps and update close distance preview to 50min | Commit 20 |
| 21 | `83b74a3ff08c4b4c42ac0f4b313b699620075236` | Sun Jul 26 16:34 | MachareteL | fix(database): add missing RLS UPDATE policy for captured_calls and use maybeSingle in completeCapturedCall | Commit 21 |
| 22 | `472c1231bd83993b6cfdbe81c660d1461346476e` | Mon Jul 27 11:32 | MachareteL | feat(logging): add structured step-by-step console logs with timing for GET, Parsing, and POST requests | Commit 22 |
| 23 | `fdb3530ad155bc98b47e7e07dec2ff0210549e1b` | Mon Jul 27 13:01 | MachareteL | fix(ui): melhora feedback ao gerar QR Code e ajusta responsividade do header no mobile | Commit 23 |
| 24 | `429a257d59e51f6c6f43db8e074aa8b5f714d7ea` | Mon Jul 27 13:05 | MachareteL | feat: add 300ms delay when retrying | Commit 24 |
| 25 | `69ee54c7aa3de7d97e150d96d93d6b9ae03a83d9` | Mon Jul 27 14:18 | MachareteL | feat(whatsapp): add phone number pairing code (8-digit) authentication flow | Commit 25 |
| 26 | `6453372d30cbbbe5b33e7270feabe3d3d44e5349` | Mon Jul 27 14:28 | MachareteL | fix(whatsapp): handle on-demand pairing code generation for existing active workers | Commit 26 |
| 27 | `54d6c8aafc34175646ffccd7eacf7272b8c62ed9` | Mon Jul 27 14:32 | MachareteL | fix(web): resolve React Error #310 by moving early return after all hook declarations | Commit 27 |
| 28 | `e3a2e8fa655e0750d511bedd67d8f75a649c5882` | Mon Jul 27 14:35 | MachareteL | build: make build:worker automatically compile types and database packages | Commit 28 |
| 29 | `8fc9ae0bc263ef62632949b575fcd218de40cc6b` | Mon Jul 27 14:43 | MachareteL | fix(worker): handle Chromium CDP context navigation rejections gracefully | Commit 29 |
| 30 | `284ea3f798e7b10aa7e56652eaac2c78b7a2b768` | Mon Jul 27 14:45 | MachareteL | fix(web): add session reset action and prevent loading state lock in QRModal | Commit 30 |
| 31 | `04177d2ce6b0e4d4c5d180f67fe7b07a85ec41c8` | Mon Jul 27 14:54 | MachareteL | fix(orchestrator): prevent killing active worker instances on transient disconnects to preserve background auto-reconnection | Commit 31 |
| 32 | `68a7b1959bef4f15b5bc92b4f59f0c85b24e0d49` | Mon Jul 27 15:02 | MachareteL | feat(ux): add intermediate AUTHENTICATING state and smooth transition modal on mobile auth success | Commit 32 |
| 33 | `aaf38d22aaf5d22a2768afba0d242e3d014c903d` | Mon Jul 27 15:03 | MachareteL | fix(worker): fix try-catch syntax error in whatsapp.ts qr event | Commit 33 |
| 34 | `8c8c87cf6bad6458ab308efbedb00474e75471aa` | Mon Jul 27 15:05 | MachareteL | fix(security): implement QR refresh rate limits and selective boot to protect VM resources and prevent IP ban | Commit 34 |
| 35 | `a5f725f43f442372985e56d56a0aeeab9ab62a16` | Mon Jul 27 15:06 | MachareteL | fix(copy): update connection modal loading text to 'Inicializando robô de automação' for privacy | Commit 35 |
| 36 | `e5ff6a38cc8d3714e0c126578e7cb1ee8e420a91` | Mon Jul 27 15:42 | MachareteL | fix(web): prevent premature loading state while typing phone number in QRModal | Commit 36 |
| 37 | `140db318a18a09dca4e1644e77c4e43bc6be5a69` | Mon Jul 27 16:08 | MachareteL | fix(worker): purge stopped worker instances on re-auth and auto-recover from detached Chromium frames | Commit 37 |
| 38 | `616c156bdeccf9b2e719d42ee5f7e1955a19410b` | Mon Jul 27 16:12 | MachareteL | perf(orchestrator): add 800ms boot stagger between tenant sessions to smooth out CPU spikes on restart | Commit 38 |
| 39 | `e1733d0cce9ac286fb2d3cfed9636b94b8614d28` | Mon Jul 27 19:14 | MachareteL | fix(worker): add DOM stabilization delay and phone format fallback for pairing code request | Commit 39 |
| 40 | `5c932a15f735b98c00bf10dd8f01292de0f8e745` | Mon Jul 27 19:17 | MachareteL | fix(worker): add waitForStorePairingCode to ensure WhatsApp Web JS bundle is ready before calling requestPairingCode | Commit 40 |
| 41 | `4c7448517ae71347cd6cd662ea247653c4af59a5` | Mon Jul 27 19:30 | MachareteL | fix(worker): implement progressive retry loop for pairing code generation against Webpack module injection delays | Commit 41 |
| 42 | `b97ac2042ff1bbaef08472d28783de7b1b6eeb48` | Mon Jul 27 19:35 | MachareteL | fix(worker): add triggerPairingCodeUI to force Webpack injection of PairingCodeLinkUtils and simulate canvas button click | Commit 42 |
| 43 | `0971002df92dcc7cc438dd622e30cdf8bd0cfa63` | Mon Jul 27 19:40 | MachareteL | fix(worker): evaluate DOM directly via pupPage.evaluate for pairing code generation to prevent undefined method errors | Commit 43 |
| 44 | `dd8387f137ebb57b0a51a642f86b7773b01d3bbc` | Mon Jul 27 19:47 | MachareteL | fix(worker): restore clean native client.requestPairingCode with 2s stabilization retry loop | Commit 44 |
| 45 | `f768b12928e7b982f5450f8806792ff12f01d8ca` | Mon Jul 27 20:07 | MachareteL | fix(worker): automatically test both national (11-digit) and international (13-digit) phone formats for pairing code generation | Commit 45 |
| 46 | `6cd0691e5b343b99dc70f4b3cd205deca7ece652` | Mon Jul 27 20:10 | MachareteL | fix(anti-ban): cap max pairing code retries to 3 per format with 2s cooldown for IP reputation protection | Commit 46 |
| 47 | `9afb450e674b8119e14650f6c0a49261e00bfb19` | Mon Jul 27 20:13 | MachareteL | fix(worker): purge stale/corrupted IndexedDB cache files for unauthenticated tenants to fix invariant #56367 | Commit 47 |
| 48 | `adb5ab7a75b87575d6fba61bc6875d3d9ad15196` | Mon Jul 27 20:31 | MachareteL | fix: implement WhatsApp worker class with session management and pairing code support | Commit 48 |
| 49 | `055854c2716e2a8c2465798f39ac4a5d7abbd926` | Mon Jul 27 21:05 | MachareteL | backup: versao estavel da autenticacao whatsapp com expurgo de sessao e pareamento por telefone sob demanda | Commit 49 |
| 50 | `e32f6248c877f3187377083894d9615b9b15fcc8` | Tue Jul 28 10:38 | MachareteL | fix(worker): prevent destroying active workers, listen to message and message_create with deduplication, and protect session directories | Commit 50 |
| 51 | `a8afe3b4a7a03ca207b06c1c2778c67ff9e9a1c0` | Tue Jul 28 10:38 | MachareteL | fix(worker): import fs module in index.ts for clean compilation | Commit 51 |
| 52 | `6ca689e837d47285e557bde26938a26bed2f7eb6` | Tue Jul 28 11:22 | MachareteL | fix(logs): silence group/status messages and enforce strict 8/8 cap for unauthenticated QR loops | Commit 52 |
| 53 | `1808578c893abe6f13dc3e01c14eba846b305a71` | Wed Jul 29 10:12 | MachareteL | fix(scraper): prioritize form input extraction over full page body text checks to prevent false positive non-retryable errors | Commit 53 |
| 54 | `64191269b994cb98dccc833fd33e6da0ae397032` | Wed Jul 29 10:19 | MachareteL | fix(scraper): eliminate false positive success reports by strictly validating GET and POST response bodies for 'already accepted' messages | Commit 54 |
| 55 | `d8ab404a523f5ef3f6ace55e8e0306b473044125` | Wed Jul 29 10:24 | MachareteL | fix(logging): print exact error message, page title, and HTML snippet when scraper cancels without retry | Commit 55 |
| 56 | `c5fe6c3f46a8b5b119bd1979aed65c5820367f92` | Wed Jul 29 12:43 | MachareteL | feat(web): mover botao de acoes para a primeira coluna no feed de chamados | Commit 56 |
| 57 | `d390a8145d0c0d7e18307aa400a3238b3e2d67b3` | Wed Jul 29 13:32 | MachareteL | feat(worker): add duplicate call detection based on ChaveConvite to prevent extra vehicle capacity consumption | Commit 57 |
| 58 | `7c6a6accbe414c19445fc80f5fae76dc77f250c3` | Wed Jul 29 16:38 | MachareteL | feat(worker): adicionar health check heartbeat anti-zumbi e deduplicação por ChaveConvite | Commit 58 |
| 59 | `12eeffb885a43857fcaf36d7fa6b69d6d09aa0b1` | Wed Jul 29 17:17 | MachareteL | fix(worker): limpar arquivos de trava SingletonLock ao reiniciar navegador zumbi | Commit 59 |
| 60 | `c23c763843dfed91cce3c07b9cb73d2e1a3cbf94` | Wed Jul 29 17:28 | MachareteL | feat(worker): auto-detectar executavel do Chromium no Linux ARM64 (Oracle Ampere) | Commit 60 |
| 61 | `680d4fdbf6b36fdf9064d50d1cafe3e8809d5792` | Wed Jul 29 18:16 | MachareteL | feat(database): adicionar script SQL cron_auto_complete.sql para finalização automatica via pg_cron | Commit 61 |
| 62 | `d7519e416b9501ab4508ceda57144ad8e8a43aff` | Wed Jul 29 18:25 | MachareteL | chore(database): atualizar intervalo do cron_auto_complete para 5 minutos | Commit 62 |
| 63 | `a2c89e7116d55de68cb142d35a096057891c12d8` | Wed Jul 29 18:26 | MachareteL | config(pm2): adicionar fuso horario TZ America/Sao_Paulo no ecosystem.config.js | Commit 63 |
| 64 | `1dda24c851f9d1cff985424ec61f09da76a0eeb6` | Wed Jul 29 22:05 | MachareteL | fix(pm2): adicionar SYSTEMD_IGNORE_CHROOT e DBUS_SESSION_BUS_ADDRESS para liberar Snap Chromium no PM2 | Commit 64 |
| 65 | `3424c85e2e041d1af5501ad8773b2d4e5d6bc083` | Thu Jul 30 09:50 | MachareteL | fix(worker): adicionar loop de auto-recuperacao/retry ao falhar abertura do Chromium e repassar envs no Puppeteer | Commit 65 |
| 66 | `e1b82b4da6ce84df87de6f469c317eb540000a67` | Thu Jul 30 10:22 | MachareteL | fix(worker): filtrar e rejeitar executaveis do Chromium vinculados ao Snap no Linux | Commit 66 |
| 67 | `ea0628d4f69259989150032ba492fcb13e6dbab7` | Thu Jul 30 10:26 | MachareteL | fix(worker): validar e desconsiderar PUPPETEER_EXECUTABLE_PATH inexistente ou vinculado ao Snap | Commit 67 |
| 68 | `82a2122a68321aa067128d2d48b84f4e3ab14049` | Thu Jul 30 10:28 | MachareteL | fix(worker): detectar e ignorar scripts de atalho do Ubuntu Snap stub em /usr/bin/chromium-browser | Commit 68 |
| 69 | `75e2546cb2323f575f62061871b5f2058a6a56cc` | Thu Jul 30 10:33 | MachareteL | perf(orchestrator): tornar a inicializacao de sessoes concorrente no boot sem bloquear o loop principal | Commit 69 |
| 70 | `3faa0000f5c4cf1cba46feb217e20b4c023a544c` | Thu Jul 30 10:34 | MachareteL | fix(worker): aumentar protocolTimeout do Puppeteer para 180s evitando timeout em leituras de IndexedDB no ARM64 | Commit 70 |
| 71 | `50ad02761325e1dc6b2c61c134600ded344385ce` | Thu Jul 30 10:36 | MachareteL | fix(worker): remover webVersionCache remota que travava inicializacao do WhatsApp Web no boot | Commit 71 |

## Documentation Verification

- **First commit**: `138879d607b441280f770a9a039b92c770783d71`
- **Last commit**: `50ad02761325e1dc6b2c61c134600ded344385ce`
- **Total commits analyzed**: 71
- **Total commits documented**: 71
- **Commits omitted**: 0
- **Current project state verified**: Yes
- **Architecture verified against source code**: Yes
# Strapi - Visão Geral Técnica

Este projeto usa Strapi com API REST, organização por domínios e customização de rotas, serviços e lifecycles.

## Conceitos usados no projeto

### Content-Types
- Coleções principais em `src/api/*/content-types/*/schema.json`.
- Modelos de domínio incluem: municipe, auth-security, first-access-control, termo, term-list, eco-coin, eco-coin-transaction, trade-item, revoked-token, brute-force-attempt, security-audit-log.

### Document API
- Operações CRUD e buscas são executadas majoritariamente via `strapi.documents(...)` nos services.

### Lifecycle Hooks
- Hooks implementados nos domínios que exigem regra de persistência.
- Exemplo: criptografia/descriptografia de dados sensíveis do munícipe e imutabilidade lógica de audit log.

### Controllers
- Recebem requisição HTTP e delegam regras para services.
- Tratam validação de entrada e retornos de erro por contexto.

### Services
- Contêm a lógica de negócio de autenticação, onboarding, consentimento, recuperação de senha, eco-coin e auditoria.

### Rotas
- Rotas customizadas por módulo em `src/api/**/routes/*.ts`.
- Rotas do plugin users-permissions também são estendidas em `src/extensions/users-permissions/strapi-server.ts`.

### Policies e Middlewares
- Policy de onboarding: `global::municipe-onboarding-guard`.
- Middlewares globais relevantes: `global::remove-api-prefix`, `global::force-https`, `global::brute-force-protection`, `global::auth-checker`.

## Fluxo de requisição (implementação atual)

1. Middlewares globais (logger, segurança, CORS, parsing, proteção).
2. Resolução de rota.
3. Execução de policy (quando configurada).
4. Controller do endpoint.
5. Service de negócio.
6. Persistência e hooks de lifecycle.
7. Resposta HTTP.

## Benefícios observados nesta base

- Separação clara entre rota, controller e service.
- Segurança com camadas: TLS/HTTPS, HSTS, brute-force, validação, revogação de token.
- Regras sensíveis centralizadas em services e utilitários.
- Auditoria de segurança dedicada com trilha de integridade.

## Limitações atuais

- Parte dos contratos funcionais está distribuída entre módulo `municipe` e extensão do plugin users-permissions.
- Há endpoints/handlers implementados em service/controller que não aparecem como rotas customizadas explícitas no mesmo módulo.
- Há divergências pontuais entre documentação histórica e comportamento real de alguns fluxos (rate limit e detalhes de revogação).
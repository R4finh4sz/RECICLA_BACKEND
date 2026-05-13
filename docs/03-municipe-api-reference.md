# Municipe - Referência de API (Implementação Atual)

Base URL: `/api`  
Autenticação: `Authorization: Bearer <jwt>` para endpoints protegidos.

## Endpoints públicos (confirmados em rota)

- `POST /register/municipes`
  - Cadastro de munícipe com validação de dados e criação do usuário.

- `POST /auth/local`
  - Início do login com senha e geração de desafio 2FA.

- `POST /auth/local/verify-code`
  - Valida o código 2FA e retorna JWT.

- `POST /auth/local/resend-code`
  - Reenvia código do desafio 2FA.

- `POST /auth/request-password-reset`
  - Solicita recuperação de senha por e-mail.
  - Implementação atual: limite de 3 solicitações por janela de 1 hora.

- `POST /auth/password-reset/validate-code`
  - Valida código de recuperação com corpo `{ email, code }`.
  - Retorna `resetToken` temporário.

- `PATCH /auth/reset-password`
  - Redefine senha com `resetToken`, `newPassword` e `confirmPassword`.

- `PATCH /auth/onboarding/accept-terms/public`
  - Endpoint público de validação do termo ativo.
  - Implementação atual: não registra consentimento nesse endpoint.

## Endpoints autenticados (confirmados em rota)

- `GET /auth/onboarding/status`
  - Retorna pendências de onboarding.

- `PATCH /auth/onboarding/accept-terms`
  - Registra aceite de termos e histórico em `term-list`.

- `PATCH /auth/onboarding/revoke-terms`
  - Revoga consentimento e reabre pendência de aceite.

- `PUT /edit-profile/:id`
  - Atualiza somente os campos permitidos de perfil.

- `POST /auth/change-password`
  - Troca senha do usuário autenticado.

- `POST /auth/delete-account`
  - Exclui conta com validação de senha atual.

- `POST /auth/logout`
  - Revoga o token atual em blacklist interna.

## Endpoints relacionados ao perfil do usuário

- `GET /users/me` (users-permissions)
  - Endpoint do plugin estendido para incluir dados de perfil do munícipe em `profile`.
  - Não há rota customizada explícita `GET /municipes/me` em `src/api/municipe/routes/custom-municipe.ts`.

## Endpoints implementados em service/controller sem rota customizada explícita no módulo

- Confirmação de e-mail por código.
- Reenvio de código de confirmação de e-mail.

Observação: esses fluxos existem em controller/service do módulo munícipe, mas não constam no arquivo de rotas customizadas desse módulo.

## Fluxo principal implementado

1. `POST /register/municipes`
2. `POST /auth/local`
3. `POST /auth/local/verify-code`
4. `GET /auth/onboarding/status`
5. `PUT /edit-profile/:id` (se necessário)
6. `PATCH /auth/onboarding/accept-terms`
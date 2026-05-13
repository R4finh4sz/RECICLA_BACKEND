# Master - Referência de API

Base URL: `/api`

Autenticação: use `Authorization: Bearer <jwt>` nas rotas protegidas.

Esta documentação reflete as rotas publicadas em `src/api/master/routes/custom-master.ts`.

## 1. Visão geral do fluxo

1. O Master é o usuário responsável por registrar Admins.
2. O cadastro público cria o usuário do plugin `users-permissions` com role `Master`.
3. O login acontece em dois passos, com 2FA por e-mail.
4. Depois de autenticado, o Master usa as rotas de onboarding, perfil, senha e logout.

## 2. Preparação no Postman

Crie um Environment com estas variáveis:

- `baseUrl`: `http://localhost:1337/api`
- `jwt`: vazio no início
- `challengeId`: vazio no início
- `resetToken`: vazio no início
- `masterDocumentId`: preencher com o `documentId` do Master quando necessário

Headers padrão para rotas JSON:

- `Content-Type: application/json`
- `Authorization: Bearer {{jwt}}` quando a rota for autenticada

## 3. Rotas públicas

### 3.1 Cadastro público de Master

- Método: `POST`
- URL: `{{baseUrl}}/register/masters`
- Handler: `api::master.master.create`
- Configuração: `auth: false`

Passo a passo:
1. Envie os dados do novo Master no corpo da requisição.
2. O backend valida CPF, e-mail, senha forte e idade mínima.
3. O sistema cria o usuário no `users-permissions` com role `Master`.
4. O documento `api::master.master` é criado com os dados protegidos.
5. Uma carteira `eco-coin` também é criada se ainda não existir.

Body exemplo:

```json
{
  "nome": "Carlos Lima",
  "email": "carlos.lima@example.com",
  "username": "carlos.lima",
  "password": "Senh@Forte123",
  "confirmPassword": "Senh@Forte123",
  "cpf": "12345678909",
  "dataNascimento": "1988-05-20",
  "endereco": "Rua das Flores",
  "numero": "123",
  "complemento": "Apto 12",
  "imagemUrl": "https://example.com/avatar.jpg",
  "cep": "01001000",
  "cidade": "Sao Paulo",
  "estado": "SP",
  "telefone": "11999999999"
}
```

Resposta esperada:

```json
{ "created": true }
```

### 3.2 Login em dois passos - etapa 1

- Método: `POST`
- URL: `{{baseUrl}}/auth/local`
- Handler: `api::master.master.loginMaster`
- Configuração: `auth: false`

Passo a passo:
1. Envie e-mail e senha.
2. Se a senha estiver correta, o backend gera um `challengeId` e um código de 6 dígitos.
3. O código é enviado por e-mail.
4. O desafio fica salvo em `auth-security`.

Body exemplo:

```json
{
  "email": "carlos.lima@example.com",
  "password": "Senh@Forte123",
  "rememberMe": false
}
```

Resposta esperada:

```json
{
  "requiresTwoFactor": true,
  "challengeId": "...",
  "expiresAt": "...",
  "rememberMe": false
}
```

No Postman, salve o `challengeId`:

```javascript
const json = pm.response.json();
if (json.challengeId) pm.environment.set("challengeId", json.challengeId);
```

### 3.3 Verificação do código 2FA

- Método: `POST`
- URL: `{{baseUrl}}/auth/local/verify-code`
- Handler: `api::master.master.verifyLoginTwoFactor`
- Configuração: `auth: false`

Body exemplo:

```json
{
  "challengeId": "{{challengeId}}",
  "code": "123456"
}
```

No Postman, salve o JWT:

```javascript
const json = pm.response.json();
if (json.jwt) pm.environment.set("jwt", json.jwt);
```

### 3.4 Reenviar código 2FA

- Método: `POST`
- URL: `{{baseUrl}}/auth/local/resend-code`
- Handler: `api::master.master.resendLoginTwoFactorCode`
- Configuração: `auth: false`

Body exemplo:

```json
{
  "challengeId": "{{challengeId}}"
}
```

## 4. Rotas de onboarding

### 4.1 Status de onboarding

- Método: `GET`
- URL: `{{baseUrl}}/auth/onboarding/status`
- Handler: `api::master.master.onboardingStatus`
- Policy: `global::master-onboarding-guard`

Passo a passo:
1. Faça login e obtenha o JWT.
2. Envie a requisição autenticada.
3. A resposta informa se o perfil, termos e senha inicial ainda precisam ser concluídos.

### 4.2 Aceitar termos

- Método: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/accept-terms`
- Handler: `api::master.master.onboardingAcceptTerms`
- Policy: `global::master-onboarding-guard`

### 4.3 Revogar termos

- Método: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/revoke-terms`
- Handler: `api::master.master.onboardingRevokeTerms`
- Policy: `global::master-onboarding-guard`

### 4.4 Aceitar termos publicamente

- Método: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/accept-terms/public`
- Handler: `api::master.master.onboardingAcceptTermsPublic`
- Configuração: `auth: false`

## 5. Rotas autenticadas de perfil

### 5.1 Obter perfil do Master autenticado

- Método: `GET`
- URL: `{{baseUrl}}/users/me` ou a rota de perfil equivalente usada no fluxo do projeto
- Handler interno: `api::master.master.me`

Passo a passo:
1. Envie o JWT.
2. O backend localiza o documento `api::master.master` ligado ao usuário autenticado.
3. A resposta retorna os dados do perfil.

### 5.2 Atualizar perfil

- Método: `PUT`
- URL: `{{baseUrl}}/edit-profile/{{masterDocumentId}}`
- Handler: `api::master.master.updateMe`
- Policy: `global::master-onboarding-guard`

Campos permitidos:

- `complemento`
- `endereco`
- `cep`
- `cidade`
- `telefone`

Body exemplo:

```json
{
  "complemento": "Casa 2",
  "endereco": "Av Paulista",
  "cep": "01310100",
  "cidade": "Sao Paulo",
  "telefone": "11988887777"
}
```

## 6. Rotas de senha e conta

### 6.1 Trocar senha

- Método: `POST`
- URL: `{{baseUrl}}/auth/change-password`
- Handler: `api::master.master.changePassword`

### 6.2 Solicitar redefinição de senha

- Método: `POST`
- URL: `{{baseUrl}}/auth/request-password-reset`
- Handler: `api::master.master.requestPasswordReset`
- Configuração: `auth: false`

### 6.3 Validar código de redefinição

- Método: `POST`
- URL: `{{baseUrl}}/auth/password-reset/validate-code`
- Handler: `api::master.master.validatePasswordResetCode`
- Configuração: `auth: false`

### 6.4 Redefinir senha

- Método: `PATCH`
- URL: `{{baseUrl}}/auth/reset-password`
- Handler: `api::master.master.resetPassword`
- Configuração: `auth: false`

### 6.5 Excluir conta

- Método: `POST`
- URL: `{{baseUrl}}/auth/delete-account`
- Handler: `api::master.master.deleteAccount`

### 6.6 Logout

- Método: `POST`
- URL: `{{baseUrl}}/auth/logout`
- Handler: `api::master.master.logout`

Passo a passo:
1. Envie o JWT no header `Authorization`.
2. O token é inserido na blacklist interna.
3. O uso futuro do mesmo JWT deve ser recusado.

## 7. Sequência recomendada para teste

1. `POST /register/masters`
2. `POST /auth/local`
3. `POST /auth/local/verify-code`
4. `GET /auth/onboarding/status`
5. `PATCH /auth/onboarding/accept-terms`
6. `PUT /edit-profile/:id`
7. `POST /auth/change-password`
8. `POST /auth/logout`

## 8. Observações importantes

- O módulo Master usa a role `Master` do plugin `users-permissions`.
- Rotas com `auth: false` continuam exigindo validação no service quando necessário.
- O onboarding é bloqueado pela policy `master-onboarding-guard` quando há pendências.
- Os dados sensíveis do content-type são protegidos por lifecycle com criptografia e hash determinístico.
- Se algum service ainda estiver como stub, ele retornará `notImplemented` até a implementação completa.

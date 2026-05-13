# Admin - Referência de API

Base URL: `/api`

Autenticação: use `Authorization: Bearer <jwt>` nas rotas protegidas.

Esta documentação reflete as rotas publicadas em `src/api/admin/routes/custom-admin.ts` e o fluxo atualmente implementado em `src/api/admin/services/`.

## 1. Visão geral do fluxo

1. O cadastro público cria o usuário do plugin `users-permissions` com role `Admin`.
2. O login acontece em dois passos: primeiro a senha, depois o código 2FA enviado por e-mail.
3. Depois de autenticado, o Admin usa as rotas de onboarding, perfil, troca de senha e encerramento de conta.
4. O logout invalida o token atual na blacklist interna.

## 2. Preparação no Postman

Crie um Environment com estas variáveis:

- `baseUrl`: `http://localhost:1337/api`
- `jwt`: vazio no início
- `challengeId`: vazio no início
- `resetToken`: vazio no início
- `adminDocumentId`: preencher com o `documentId` do Admin quando necessário

Headers padrão para rotas JSON:

- `Content-Type: application/json`
- `Authorization: Bearer {{jwt}}` quando a rota for autenticada

## 3. Rotas públicas

### 3.1 Cadastro público de Admin

- Método: `POST`
- URL: `{{baseUrl}}/register/admins`
- Handler: `api::admin.admin.create`
- Configuração: `auth: false`

Passo a passo:
1. Envie os dados do novo Admin no corpo da requisição.
2. O backend valida CPF, e-mail, senha forte e idade mínima.
3. O sistema cria o usuário no `users-permissions` com role `Admin`.
4. O documento `api::admin.admin` é criado com os dados protegidos.
5. Uma carteira `eco-coin` também é criada se ainda não existir.

Body exemplo:

```json
{
  "nome": "Maria Souza",
  "email": "maria.souza@example.com",
  "username": "maria.souza",
  "password": "Senh@Forte123",
  "confirmPassword": "Senh@Forte123",
  "cpf": "12345678909",
  "dataNascimento": "1990-05-20",
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
- Handler: `api::admin.admin.loginMunicipe`
- Configuração: `auth: false`

Passo a passo:
1. Envie e-mail e senha.
2. Se a senha estiver correta, o backend gera um `challengeId` e um código de 6 dígitos.
3. O código é enviado por e-mail.
4. O desafio fica salvo em `auth-security`.

Body exemplo:

```json
{
  "email": "maria.souza@example.com",
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
- Handler: `api::admin.admin.verifyLoginTwoFactor`
- Configuração: `auth: false`

Passo a passo:
1. Envie o `challengeId` recebido na etapa anterior.
2. Envie o código de 6 dígitos recebido por e-mail.
3. Se o código estiver válido, o backend retorna o JWT.

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
- Handler: `api::admin.admin.resendLoginTwoFactorCode`
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
- Handler: `api::admin.admin.onboardingStatus`
- Policy: `global::admin-onboarding-guard`

Passo a passo:
1. Faça login e obtenha o JWT.
2. Envie a requisição autenticada.
3. A resposta informa se o perfil, termos e senha inicial ainda precisam ser concluídos.

### 4.2 Aceitar termos

- Método: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/accept-terms`
- Handler: `api::admin.admin.onboardingAcceptTerms`
- Policy: `global::admin-onboarding-guard`

### 4.3 Revogar termos

- Método: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/revoke-terms`
- Handler: `api::admin.admin.onboardingRevokeTerms`
- Policy: `global::admin-onboarding-guard`

### 4.4 Aceitar termos publicamente

- Método: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/accept-terms/public`
- Handler: `api::admin.admin.onboardingAcceptTermsPublic`
- Configuração: `auth: false`

## 5. Rotas autenticadas de perfil

### 5.1 Obter perfil do Admin autenticado

- Método: `GET`
- URL: `{{baseUrl}}/users/me` ou rota equivalente de perfil usada no fluxo do projeto
- Handler interno: `api::admin.admin.me`

Passo a passo:
1. Envie o JWT.
2. O backend localiza o documento `api::admin.admin` ligado ao usuário autenticado.
3. A resposta retorna os dados do perfil.

### 5.2 Atualizar perfil

- Método: `PUT`
- URL: `{{baseUrl}}/edit-profile/{{adminDocumentId}}`
- Handler: `api::admin.admin.updateMe`
- Policy: `global::admin-onboarding-guard`

Campos permitidos:

- `complemento`
- `endereco`
- `cep`
- `cidade`
- `telefone`

Passo a passo:
1. Envie o JWT.
2. Use o `documentId` do Admin na URL.
3. Atualize apenas os campos permitidos.
4. O backend rejeita mudanças em nome, CPF e e-mail.

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
- Handler: `api::admin.admin.changePassword`

Body exemplo:

```json
{
  "currentPassword": "Senh@Forte123",
  "newPassword": "N0v@SenhaForte123",
  "confirmPassword": "N0v@SenhaForte123"
}
```

### 6.2 Solicitar redefinição de senha

- Método: `POST`
- URL: `{{baseUrl}}/auth/request-password-reset`
- Handler: `api::admin.admin.requestPasswordReset`
- Configuração: `auth: false`

Passo a passo:
1. Envie o e-mail do Admin.
2. O sistema gera o fluxo de reset e registra o evento.
3. O comportamento atual do projeto é o mesmo da implementação do módulo Admin.

### 6.3 Validar código de redefinição

- Método: `POST`
- URL: `{{baseUrl}}/auth/password-reset/validate-code`
- Handler: `api::admin.admin.validatePasswordResetCode`
- Configuração: `auth: false`

### 6.4 Redefinir senha

- Método: `PATCH`
- URL: `{{baseUrl}}/auth/reset-password`
- Handler: `api::admin.admin.resetPassword`
- Configuração: `auth: false`

### 6.5 Excluir conta

- Método: `POST`
- URL: `{{baseUrl}}/auth/delete-account`
- Handler: `api::admin.admin.deleteAccount`

### 6.6 Logout

- Método: `POST`
- URL: `{{baseUrl}}/auth/logout`
- Handler: `api::admin.admin.logout`

Passo a passo:
1. Envie o JWT no header `Authorization`.
2. O token é inserido na blacklist interna.
3. O uso futuro do mesmo JWT deve ser recusado.

## 7. E-mail de confirmação

### 7.1 Confirmar código de e-mail

- Método: consultar o service/controller associado em `src/api/admin/services/confirm-email-code.ts`
- Observação: esta função existe na implementação do módulo, mas não está exposta como rota customizada em `custom-admin.ts`.

### 7.2 Reenviar código de confirmação

- Método: consultar o service/controller associado em `src/api/admin/services/resend-email-confirmation-code.ts`
- Observação: também existe na implementação, mas não está exposta como rota customizada em `custom-admin.ts`.

## 8. Sequência recomendada para teste

1. `POST /register/admins`
2. `POST /auth/local`
3. `POST /auth/local/verify-code`
4. `GET /auth/onboarding/status`
5. `PATCH /auth/onboarding/accept-terms`
6. `PUT /edit-profile/:id`
7. `POST /auth/change-password`
8. `POST /auth/logout`

## 9. Observações importantes

- O módulo Admin usa a role `Admin` do plugin `users-permissions`.
- Rotas com `auth: false` continuam exigindo validação no service quando necessário.
- O onboarding é bloqueado pela policy `admin-onboarding-guard` quando há pendências.
- Os dados sensíveis do content-type são protegidos por lifecycle com criptografia e hash determinístico.

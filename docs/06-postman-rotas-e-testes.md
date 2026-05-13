# Guia de Rotas e Testes no Postman

Este guia descreve as rotas publicadas no backend e como testá-las no Postman com payloads prontos.

## 1) Preparacao no Postman

Crie um Environment com estas variaveis:

- `baseUrl`: `http://localhost:1337/api`
- `jwt`: vazio inicialmente
- `challengeId`: vazio inicialmente
- `resetToken`: vazio inicialmente
- `municipeDocumentId`: preencher quando tiver o `documentId` do municipe
- `tradeItemId`: preencher com ID de item ativo para teste de resgate

Headers padrao para requests JSON:

- `Content-Type: application/json`
- `Authorization: Bearer {{jwt}}` (somente quando a rota for autenticada)

## 2) Rotas publicas

## 2.1 Registro

- Metodo: `POST`
- URL: `{{baseUrl}}/register/municipes`
- Body (raw JSON):

```json
{
  "nome": "Joao Silva",
  "email": "joao.silva@example.com",
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

Retorno esperado: objeto com `created: true`.

## 2.2 Login (passo 1 - gera desafio 2FA)

- Metodo: `POST`
- URL: `{{baseUrl}}/auth/local`
- Body:

```json
{
  "email": "joao.silva@example.com",
  "password": "Senh@Forte123",
  "rememberMe": false
}
```

Retorno esperado: `requiresTwoFactor`, `challengeId`, `expiresAt`.

No Postman (Tests), salve o challengeId:

```javascript
const json = pm.response.json();
if (json.challengeId) pm.environment.set("challengeId", json.challengeId);
```

## 2.3 Login (passo 2 - valida 2FA e retorna JWT)

- Metodo: `POST`
- URL: `{{baseUrl}}/auth/local/verify-code`
- Body:

```json
{
  "email": "joao.silva@example.com",
  "challengeId": "{{challengeId}}",
  "code": "123456"
}
```

Observacao: o `code` chega por e-mail.

No Postman (Tests), salve o JWT:

```javascript
const json = pm.response.json();
if (json.jwt) pm.environment.set("jwt", json.jwt);
```

## 2.4 Reenviar codigo 2FA

- Metodo: `POST`
- URL: `{{baseUrl}}/auth/local/resend-code`
- Body:

```json
{
  "email": "joao.silva@example.com",
  "challengeId": "{{challengeId}}"
}
```

Retorno esperado: `sent: true` e novo `expiresAt`.

## 2.5 Recuperacao de senha - solicitar codigo

- Metodo: `POST`
- URL: `{{baseUrl}}/auth/request-password-reset`
- Body:

```json
{
  "email": "joao.silva@example.com"
}
```

Retorno esperado: `sent: true`.

## 2.6 Recuperacao de senha - validar codigo

- Metodo: `POST`
- URL: `{{baseUrl}}/auth/password-reset/validate-code`
- Body:

```json
{
  "email": "joao.silva@example.com",
  "code": "123456"
}
```

No Postman (Tests), salve o resetToken:

```javascript
const json = pm.response.json();
if (json.resetToken) pm.environment.set("resetToken", json.resetToken);
```

## 2.7 Recuperacao de senha - redefinir

- Metodo: `PATCH`
- URL: `{{baseUrl}}/auth/reset-password`
- Body:

```json
{
  "resetToken": "{{resetToken}}",
  "newPassword": "N0v@SenhaForte123",
  "confirmPassword": "N0v@SenhaForte123"
}
```

## 2.8 Termo ativo (publico)

- Metodo: `GET`
- URL: `{{baseUrl}}/termos/active`

Alternativa equivalente:

- `GET {{baseUrl}}/autoregister/termos/active`

## 2.9 PDF do termo ativo

- Metodo: `GET`
- URL: `{{baseUrl}}/termos/active/pdf`

## 2.10 Validacao publica de aceite

- Metodo: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/accept-terms/public`
- Body (pode enviar vazio):

```json
{}
```

Retorno esperado: confirmacao de termo valido para aceite.

## 3) Rotas autenticadas

Use `Authorization: Bearer {{jwt}}`.

## 3.1 Perfil do usuario autenticado

- Metodo: `GET`
- URL: `{{baseUrl}}/users/me`

Retorno inclui dados basicos do usuario e `profile` do municipe.

## 3.2 Status de onboarding

- Metodo: `GET`
- URL: `{{baseUrl}}/auth/onboarding/status`

## 3.3 Aceitar termos (autenticado)

- Metodo: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/accept-terms`
- Body (pode enviar vazio):

```json
{}
```

## 3.4 Revogar termos

- Metodo: `PATCH`
- URL: `{{baseUrl}}/auth/onboarding/revoke-terms`
- Body:

```json
{}
```

## 3.5 Editar perfil do municipe

- Metodo: `PUT`
- URL: `{{baseUrl}}/edit-profile/{{municipeDocumentId}}`
- Campos permitidos: `complemento`, `endereco`, `cep`, `cidade`, `telefone`
- Body exemplo:

```json
{
  "complemento": "Casa 2",
  "endereco": "Av Paulista",
  "cep": "01310100",
  "cidade": "Sao Paulo",
  "telefone": "11988887777"
}
```

Importante: o endpoint exige `documentId` do municipe na URL.

## 3.6 Trocar senha (autenticado)

- Metodo: `POST`
- URL: `{{baseUrl}}/auth/change-password`
- Body:

```json
{
  "currentPassword": "Senh@Forte123",
  "newPassword": "N0v@SenhaForte123",
  "confirmPassword": "N0v@SenhaForte123"
}
```

## 3.7 Carteira eco-coin do usuario

- Metodo: `GET`
- URL: `{{baseUrl}}/eco-coin/me`

## 3.8 Resgatar item com eco-coin

- Metodo: `POST`
- URL: `{{baseUrl}}/eco-coin/redeem`
- Body:

```json
{
  "tradeItemId": 1
}
```

Se quiser usar variavel:

```json
{
  "tradeItemId": {{tradeItemId}}
}
```

## 3.9 Historico de transacoes eco-coin

- Metodo: `GET`
- URL: `{{baseUrl}}/eco-coin-transactions/me`

## 3.10 Logout

- Metodo: `POST`
- URL: `{{baseUrl}}/auth/logout`
- Body:

```json
{}
```

Apos logout, limpe `jwt` no Environment para evitar uso de token revogado.

## 3.11 Deletar conta

- Metodo: `POST`
- URL: `{{baseUrl}}/auth/delete-account`
- Body:

```json
{
  "currentPassword": "N0v@SenhaForte123"
}
```

## 4) Sequencia recomendada de teste (end-to-end)

1. `POST /register/municipes`
2. `POST /auth/local`
3. `POST /auth/local/verify-code`
4. `GET /users/me`
5. `GET /auth/onboarding/status`
6. `PATCH /auth/onboarding/accept-terms`
7. `GET /eco-coin/me`
8. `GET /eco-coin-transactions/me`
9. `POST /auth/logout`

## 5) Erros comuns no Postman

- `401 Unauthorized`: token ausente, expirado ou revogado.
- `429 Too Many Requests`: bloqueio/rate limit em fluxos de autenticacao.
- `400 Bad Request`: payload invalido (campos ausentes, formato invalido, senha fora da politica).
- `403 Forbidden`: regra de role/policy impedindo a acao.

## 6) Observacoes importantes

- O backend aplica prefixo `/api` para rotas publicas de conteudo.
- Existe implementacao de confirmacao de e-mail em services/controllers do modulo municipe, mas sem rota customizada explicita no arquivo `src/api/municipe/routes/custom-municipe.ts`.
- Este guia cobre as rotas efetivamente publicadas nos arquivos de rota e extensao auditados.

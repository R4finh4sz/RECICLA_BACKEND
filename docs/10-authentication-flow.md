# Fluxo de Autenticação - Visão Consolidada

Este documento descreve o fluxo completo de autenticação implementado: login com senha, 2FA e emissão de JWT.

## 1. Visão Geral do Fluxo

O processo de autenticação ocorre em duas etapas principais:

**Primeira etapa - Autenticação inicial com senha:**
O cliente envia um pedido POST para `/auth/local` com email, senha e opcionalmente um flag de "rememberMe". O servidor valida os dados usando esquema Zod, verifica proteção contra força bruta, busca o usuário no banco de dados por email, valida a senha comparando-a com o hash armazenado usando bcryptjs, e registra a tentativa. Se a senha for inválida, retorna erro 400. Se for válida, o servidor gera um código 2FA de 6 dígitos, um identificador único (challengeId) do tipo UUID, e define um tempo de expiração de 10 minutos. O código é enviado por email para o usuário e o sistema registra um evento de auditoria.

**Segunda etapa - Verificação do código 2FA:**
O cliente envia outro pedido POST para `/auth/local/verify-code` com email, challengeId e o código recebido por email. O servidor valida novamente os dados, busca o usuário, localiza o desafio 2FA armazenado, valida o challengeId para garantir que corresponde ao solicitado, verifica se o código não expirou, compara o código recebido com o armazenado. Se qualquer validação falhar, retorna erro 400. Se o código for válido, o servidor gera um token JWT com validade de 1 dia (ou 30 dias se rememberMe estiver ativo), registra o horário do login bem-sucedido, o IP do cliente e o User-Agent, limpa os dados temporários do desafio 2FA, e registra um evento de auditoria de sucesso.

## 2. Detalhes de Cada Etapa

### 2.1 Autenticação Inicial (Login com Senha)

**Endpoint:** `POST /auth/local`

**Payload:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "rememberMe": false
}
```

**Validações de entrada (Zod schema):**
- `email`: obrigatório, formato válido de email
- `password`: obrigatório, string não vazia
- `rememberMe`: opcional, booleano

**Lógica no servidor (`src/api/municipe/services/municipe-login.ts`):**

1. **Validar entrada**
   - Parse com Zod schema
   - Se inválido → retorna `400 Bad Request` com detalhes de erro

2. **Extrair identificadores**
   - Captura IP do cliente (x-forwarded-for ou ctx.request.ip)
   - Captura User-Agent da requisição

3. **Verificar bloqueio por brute-force**
   - Consulta tabela `brute-force-attempt` por email
   - Se bloqueado (15 minutos desde última tentativa falha) → retorna `429 Too Many Requests`
   - Registra evento: `auth.login.blocked`

4. **Buscar usuário**
   - Query em `plugin::users-permissions.user` pelo email (normalizado lowercase)
   - Se não encontrado → registra tentativa falha, registra evento `auth.login.failed` e retorna `400 Bad Request` genérico

5. **Validar senha**
   - Compara entrada com hash armazenado usando `bcrypt.compare(password, user.password)`
   - Suporta salt derivado legado se necessário (deriveSaltFromUser)
   - Se inválido → registra tentativa falha com delay progressivo (500ms × número de tentativas)
   - Registra evento `auth.login.failed`
   - Retorna `400 Bad Request` genérico

6. **Se senha válida:**
   - Registra tentativa de sucesso
   - Busca ou cria documento `auth-security` linkado ao usuário

7. **Gerar desafio 2FA**
   - Código: `crypto.randomInt(100000, 1000000)` → string de 6 dígitos
   - Challenge ID: `crypto.randomUUID()` → UUID válido
   - TTL: `now + 10 * 60 * 1000` (10 minutos)
   - Armazena em `auth-security`: `loginTwoFactorCode`, `loginTwoFactorChallengeId`, `loginTwoFactorExpiresAt`
   - Também armazena flag `loginTwoFactorRememberMe` com valor do payload

8. **Enviar email**
   - Plugin de email do Strapi envia código para o endereço do usuário
   - Assunto: "Recicla Online - Codigo de verificacao de login"
   - Corpo: código + aviso de expiração (10 minutos)
   - Se falha → retorna `500 Internal Server Error`

9. **Registrar evento de auditoria**
   - Tipo: `auth.login.2fa-challenge-issued`
   - Nível: `info`
   - Metadados: `expiresAt` (ISO 8601)
   - Email mascarado nos logs (apenas 2 primeiros caracteres visíveis)

**Resposta de sucesso (HTTP 200):**
```json
{
  "requiresTwoFactor": true,
  "challengeId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2026-05-13T15:45:30.000Z",
  "rememberMe": false,
  "user": {
    "role": { "id": 1 }
  }
}
```

---

### 2.2 Proteção contra Brute-Force

**Implementação em `src/api/municipe/services/brute-force.service.ts`:**

- Identificador: email do login
- Limite: 5 tentativas falhas
- Bloqueio: 15 minutos (900 segundos)
- Delay progressivo: `500ms * número_de_tentativas_registradas`
- Persistência: tabela `brute-force-attempt`

**Fluxo:**
1. Antes de validar senha → verifica `isBlocked(email)`
2. Após validar senha → registra `recordAttempt(email, senhaValida)`
3. Se 5ª tentativa falha → bloqueia para próximas 15 minutos
4. Cada tentativa falha ativa delay antes de retornar 400

---

### 2.3 Verificação do Código 2FA

**Endpoint:** `POST /auth/local/verify-code`

**Payload:**
```json
{
  "email": "user@example.com",
  "challengeId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "123456"
}
```

**Validações de entrada (Zod schema `LoginTwoFactorVerifySchema`):**
- `email`: obrigatório, formato válido de email
- `challengeId`: obrigatório, string não vazia (UUID esperado)
- `code`: obrigatório, exatamente 6 dígitos (regex `/^\d{6}$/`)

**Lógica no servidor (`src/api/municipe/services/verify-login-2fa.ts`):**

1. **Validar entrada**
   - Parse com Zod schema
   - Se inválido → retorna `400 Bad Request` com detalhes de erro

2. **Buscar usuário**
   - Query por email normalizado (lowercase)
   - Se não encontrado → registra evento `auth.2fa.failed` com reason `user-not-found` e retorna `400 Bad Request` genérico

3. **Buscar desafio 2FA armazenado**
   - Consulta `auth-security` linkado ao usuário
   - Se ausente → registra evento `auth.2fa.failed` com reason `session-missing-or-expired` e retorna `400 Bad Request` genérico
   - Se campos vazios (`loginTwoFactorCode`, `loginTwoFactorExpiresAt`) → mesmo resultado

4. **Validar challengeId**
   - Compara `payload.challengeId` com `security.loginTwoFactorChallengeId` armazenado
   - Se mismatch → registra evento `auth.2fa.failed` com reason `challenge-mismatch` e retorna `400 Bad Request` genérico

5. **Validar expiração**
   - Converte `loginTwoFactorExpiresAt` para timestamp
   - Se `Date.now() > expiresAt` → limpa desafio, registra evento `auth.2fa.failed` com reason `code-expired` e retorna `400 Bad Request` genérico

6. **Validar código**
   - Compara `payload.code` com `security.loginTwoFactorCode` armazenado (string-to-string)
   - Se mismatch → registra evento `auth.2fa.failed` com reason `code-mismatch` e retorna `400 Bad Request` genérico

7. **Se código válido:**
   - Recupera flag `rememberMe` do desafio armazenado
   - Define duração do JWT: `24 horas` (rememberMe=false) ou `720 horas / 30 dias` (rememberMe=true)
   - Define `expiresIn`: `'1d'` ou `'30d'`

8. **Gerar JWT**
   - Chama `jwtService.issue({ id: user.id }, { expiresIn })`
   - Plugin `users-permissions` retorna token assinado

9. **Atualizar registro de auditoria**
   - Define `lastLoginAt` = now
   - Define `lastLoginIp` = IP extraído de x-forwarded-for ou ctx.request.ip
   - Define `lastLoginUserAgent` = User-Agent da requisição
   - Limpa desafio 2FA: `loginTwoFactorChallengeId = null`, `loginTwoFactorCode = null`, `loginTwoFactorExpiresAt = null`, `loginTwoFactorRememberMe = false`

10. **Registrar evento de auditoria**
    - Tipo: `auth.login.success`
    - Nível: `info`
    - Metadados: `rememberMe` (booleano)
    - Email mascarado nos logs

**Resposta de sucesso (HTTP 200):**
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 42,
    "documentId": "abc123def456",
    "username": "johndoe",
    "email": "user@example.com",
    "role": {
      "id": 3,
      "name": "Municipe",
      "type": "public"
    }
  },
  "twoFactorSkippedUntil": null,
  "rememberMe": false,
  "expiresAt": "2026-05-14T15:45:30.000Z"
}
```

---

### 2.4 Reenvio de Código 2FA

**Endpoint:** `POST /auth/local/resend-2fa-code`

**Payload:**
```json
{
  "email": "user@example.com",
  "challengeId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Lógica (`src/api/municipe/services/resend-login-2fa-code.ts`):**

1. Valida entrada (Zod schema)
2. Busca usuário por email
3. Se não encontrado → retorna silenciosamente `{ sent: true }` (privacy)
4. Busca desafio 2FA armazenado
5. Se sessão expirada/ausente → retorna `400 Bad Request`
6. Se challengeId mismatch → retorna `400 Bad Request`
7. Se desafio expirou → retorna `400 Bad Request`
8. Gera novo código (6 dígitos)
9. Atualiza expiração para now + 10 minutos
10. Envia email com novo código
11. Retorna `{ sent: true, expiresAt }`

---

## 3. Fluxos de Erro Documentados

| Cenário | Status | Mensagem | Evento Auditado 
| Entrada inválida | 400 | "Dados de login inválidos" + detalhes Zod | ❌ |
| Brute-force ativo | 429 | "Sua conta está temporariamente bloqueada por 15 minutos" | ✅ `auth.login.blocked` |
| Email não encontrado | 400 | "E-mail ou senha inválidos" | ✅ `auth.login.failed` |
| Senha incorreta | 400 | "E-mail ou senha inválidos" | ✅ `auth.login.failed` + delay |
| Email para 2FA falha | 500 | "Nao foi possivel enviar o codigo de verificacao por email" | ✅ `auth.login.2fa-challenge-issued` |
| 2FA: código expirado | 400 | "Codigo invalido ou expirado" | ✅ `auth.2fa.failed` (reason: code-expired) |
| 2FA: código incorreto | 400 | "Codigo invalido ou expirado" | ✅ `auth.2fa.failed` (reason: code-mismatch) |
| 2FA: challengeId inválido | 400 | "Sessao de autenticacao expirada. Faca login novamente." | ✅ `auth.2fa.failed` (reason: challenge-mismatch) |
| 2FA: sucesso | 200 | JWT + user data | ✅ `auth.login.success` |

---

## 4. Configurações Relevantes

| Parâmetro | Valor | Origem |
| Rounds bcrypt | 12 (padrão) | `src/utils/password-hash.ts` |
| Range bcrypt | 10-15 | `src/utils/password-hash.ts` |
| TTL 2FA | 10 minutos | `src/api/*/services/*-login.ts` |
| Código 2FA | 6 dígitos | `crypto.randomInt(100000, 1000000)` |
| Limite brute-force | 5 tentativas | `BruteForceService` |
| Bloqueio brute-force | 15 minutos | `BruteForceService` |
| Delay progressivo | 500ms × tentativas | `BruteForceService` |
| JWT padrão | 1 dia | `jwtService.issue()` |
| JWT com rememberMe | 30 dias | `jwtService.issue()` |

---

## 5. Módulos com Implementação Idêntica

O fluxo descrito acima é implementado **identicamente** em:
- `src/api/municipe/services/` (usuário tipo Municipe)
- `src/api/admin/services/` (usuário tipo Admin, criado por Master)
- `src/api/master/services/` (usuário tipo Master, criado pelo sistema ou por outro Master)

Cada módulo tem seus próprios:
- `*-login.ts` (login com 2FA)
- `verify-login-2fa.ts` (verificação de código)
- `resend-login-2fa-code.ts` (reenvio de código)
- Schemas de validação correspondentes

---

## 6. Integração com Auditoria de Segurança

Todos os eventos abaixo são registrados em tempo real em `api::security-audit-log.security-audit-log`:

```typescript
{
  eventType: 'auth.login.blocked' | 'auth.login.failed' | 'auth.login.2fa-challenge-issued' | 'auth.2fa.failed' | 'auth.login.success',
  level: 'warn' | 'info',
  message: string,
  userId?: number,
  userEmailMasked: string, // ex: "us***"
  ip: string,
  userAgent: string,
  metadata?: {
    blocked?: boolean,
    expiresAt?: string,
    reason?: 'user-not-found' | 'session-missing-or-expired' | 'challenge-mismatch' | 'code-expired' | 'code-mismatch',
    rememberMe?: boolean,
  }
}
```

Eventos registrados com **integridade garantida**: hash encadeado + assinatura HMAC.

---

## 7. Teste Manual com Postman

### Passo 1: Login
```
POST {{baseUrl}}/auth/local
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "SecurePassword123!",
  "rememberMe": false
}
```

Resultado esperado: `200 OK`
```json
{
  "requiresTwoFactor": true,
  "challengeId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2026-05-13T15:45:30.000Z"
}
```

Copiar `challengeId` e aguardar email com código (ou verificar logs).

### Passo 2: Verificar Código 2FA
```
POST {{baseUrl}}/auth/local/verify-code
Content-Type: application/json

{
  "email": "test@example.com",
  "challengeId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "123456"
}
```

Resultado esperado: `200 OK`
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... },
  "rememberMe": false,
  "expiresAt": "2026-05-14T15:45:30.000Z"
}
```

Usar `jwt` no header `Authorization: Bearer <token>` para requisições subsequentes.

---

## 8. Referências

- Implementação: `src/api/*/services/*-login.ts`, `verify-login-2fa.ts`, `resend-login-2fa-code.ts`
- Validação: `src/api/*/validation/*Schema.ts`
- Brute-force: `src/api/*/services/brute-force.service.ts`
- Hash: `src/utils/password-hash.ts`
- Auditoria: `src/utils/security-audit-log.ts`
- Content-type: `src/api/auth-security/content-types/auth-security/schema.json`

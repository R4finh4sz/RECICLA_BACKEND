# Módulo Municipe - Arquitetura & Design

O módulo Municipe gerencia o ciclo de vida completo de usuários que administram prefeituras. Implementa fluxos de autenticação, onboarding, segurança e conformidade LGPD.

## Estrutura

O módulo está organizado em: content-types (schema.json e lifecycles.ts), controllers (handlers HTTP), routes (mapeamento de endpoints), services (lógica de negócio), validation (schemas com Zod) e utils (funções auxiliares de criptografia, hashing, brute-force, email, etc).

## Content-Type: Municipe

### Schema

**Collection Type** com as seguintes características:
- `draftAndPublish: false` (sem versionamento)
- Relacionamento 1:1 com `users-permissions.user`
- Suporte a criptografia em repouso

### Atributos

| Campo | Tipo | 
|-------|------|
| `nome` | string | 
| `cpf` | string | 
| `cpfHash` | string | 
| `dataNascimento` | date | 
| `telefone` | string | 
| `cep` | string |
| `endereco` | string |
| `numero` | string | 
| `complemento` | string |
| `cidade` | string | 
| `estado` | string | 
| `imagemUrl` | string | 
| `user` | relation | 

### Modelo ER (Simplified)

```
┌─────────────────────┐
│   users-permission  │
│       (user)        │
├─────────────────────┤
│ id (PK)             │
│ email (UNIQUE)      │
│ password            │
│ confirmed           │
│ role (FK)           │
│ createdAt           │
└──────────┬──────────┘
É um Collection Type sem versionamento com relacionamento 1:1 com users-permissions.user. 

Atributos obrigatórios: nome, cpf, dataNascimento, telefone, cep, endereco, numero, cidade, estado. Atributos opcionais: complemento, imagemUrl.

Campos criptografados em AES-256-GCM: cpf, cpfHash (para busca), telefone, cep, endereco, numero, complemento.

Campos únicos: cpf e cpfHash (para validar duplicidade sem expor plaintext).

Relacionamento: vinculado a um usuário via campo user.ph TD
    A["POST /register/municipes<br/>Body: nome, email, cpf, ..."] --> B{"Valida<br/>Schema?"}
    B -->|Não| C["400 Bad Request<br/>Dados inválidos"]
    B -->|Sim| D{"Email<br/>existe?"}
    D -->|Sim| E["400 Bad Request<br/>Email já cadastrado"]
    D -->|Não| F{"CPF<br/>existe?"}
    F -->|Sim| G["400 Bad Request<br/>CPF já cadastrado"]
    F -->|Não| H["Hash password<br/>com bcrypt"]
    H --> I["Criar user<br/>users-permissions"]
    I --> J["Criar municipe<br/>Document API"]
    J --> K["beforeCreate hook<br/>Encriptar campos"]
    K --> L["afterCreate hook<br/>Desencriptar resposta"]
    L --> M["201 Created<br/>return { data, message }"]
    
    style C fill:#ffcccc
    style E fill:#ffcccc
    style G fill:#ffcccc
    style M fill:#ccffcc
```

### 2. Autenticação com 2FA (Login)

**Passo 1: Requisição de Login**
```
POST /auth/local
Body: { email, password, rememberMe }

├─ Validar email/password format
├─ Buscar usuário por email
├─ Validar brute-force (máx 5 tentativas em 15 min)
├─ Comparar password com bcrypt hash
├─ Gerar 6-digit code (validade 10 min)
├─ Criar challenge session
├─ Enviar código por email
└─ HTTP 200 { challengeId, message: "Código enviado" }
```

**Passo 2: Verificação 2FA**
```
POST /auth/local/verify-code
Body: { email, code, challengeId }

├─ Validar código contra challenge
├─ Gerar JWT token
│  ├─ Sub: userId
│  ├─ Rol: "Municipe"
│  ├─ Exp: rememberMe ? 30d : 1d
│  └─ TokenId: uuid (para revogação)
├─ Revogar challenge usado
└─ HTTP 200 { jwt, user: { id, email, ... } }
```

**Fluxograma:**

```
User
  │
  ├─→ [1] POST /auth/local { email, password }
  │       ├─ Valida credenciais
  │       ├─ Gera code 6-digit
  │       ├─ Salva challenge (email + code + timestamp)
  │       └─ Envia email com código
  │Registro Público

O fluxo de registro recebe POST em /register/municipes. Valida entrada com Zod schema. Verifica duplicidade de email e CPF. Cria usuário em users-permissions com hash bcrypt. Cria municipe com beforeCreate hook que normaliza dados, criptografa campos sensíveis e gera cpfHash. O afterCreate hook desencripta campos para resposta. Retorna 201 com dados do novo municipe.

### Autenticação com 2FA

Tem dois passos. Passo 1: POST /auth/local com email e password. Valida credenciais, verifica brute-force, gera code 6-digit com validade de 10 minutos, salva challenge e envia por email. Retorna challengeId. Passo 2: POST /auth/local/verify-code com email, code e challengeId. Valida correspondência, gera JWT token com expiração (1 dia ou 30 dias se rememberMe), revoga challenge. Retorna JWT e dados do usuário.

### Onboarding

Após login, o usuário tem status de onboarding incompleto. GET /auth/onboarding/status retorna quais etapas faltam: completar perfil, aceitar termos, mudar senha. PUT /edit-profile/:id atualiza dados editáveis. PATCH /auth/onboarding/accept-terms registra aceitação em first-access-control e cria entry em term-list para auditoria. Quando todas as etapas completam, o usuário fica liberado.

### Recuperação de Senha

Tem três passos. Passo 1: POST /auth/request-password-reset com email. Verifica existência, rate limit (máx 3 por 10 min), gera token com TTL 1 hora e envia por email. Passo 2: POST /auth/password-reset/validate-code com token para validar. Passo 3: PATCH /auth/reset-password com novo password. Valida força, atualiza no banco e revoga todos os tokens existentes.(firstAccessControl.mustChangePassword) return 403;  // Mude sua senha
```

## Tratamento de Erros

```typescript
// Padrão de erro:
{
  "status": 400,
  "name": "BadRequestError",
  "message": "Descrição do erro em português",
  "details": { /* contexto adicional */ }
}

// Exemplos:
400 - Email já cadastrado
400 - CPF já cadastrado
400 - Dados inválidos no cadastro
401 - Token expirado
401 - Brute-force: tente novamente em 15 minutos
403 - Complete seu perfil antes de continuar
409 - Conflito: recurso já existe
422 - Unprocessable Entity: validação falhou
500 - Internal Server Error
```

---
**Criptografia em Repouso**: Usa AES-256-GCM em campos sensíveis (CPF, telefone, CEP, endereço, número, complemento). Cada criptografia gera IV aleatório diferente, impedindo ataques de padrão.

**Proteção contra Brute-Force**: Máximo 5 tentativas de login por email em 15 minutos. A 6ª tentativa é bloqueada com exponential backoff (500ms × attempt_number).

**Two-Factor Authentication**: Código de 6 dígitos com validade de 10 minutos, vinculado a um challenge UUID que associa email + código.

**Validação de Senha**: Obrigatório 8+ caracteres, maiúscula, minúscula, número e caractere especial.

**Conformidade LGPD**: Consentimento explícito em accept-terms, direito ao esquecimento em delete-account, auditoria de acessos em security-audit-log, criptografia de sensíveis, mascaramento em logs, versionamento de termos.

**Policy Onboarding**: Força fluxo de onboarding bloqueando acessos se perfil incompleto, termos não aceitos ou senha não mudada.Tratamento de Erros

Erros retornam com status HTTP apropriado (400, 401, 403, etc), nome do erro e mensagem em português. Exemplos: 400 para email/CPF duplicado, 401 para token expirado ou brute-force, 403 para profile incompleto, 422 para validação falhou.
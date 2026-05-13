# Atendimento aos Direitos LGPD - Fluxos Implementados

Este documento descreve os fluxos implementados para atendimento dos direitos do titular de dados conforme Lei Geral de Proteção de Dados (LGPD).

---

## 1. Direito de Consentimento

### Aceitar Termos e Condições

**Endpoint:** `PATCH /auth/onboarding/accept-terms`

**Autenticação:** Requerida (JWT token)

**Payload:**
```json
{}
```

**Lógica implementada (`src/api/*/services/onboarding-accept-terms.ts`):**

1. Valida se usuário está autenticado
2. Valida se usuário é do tipo Municipe
3. Busca termo mais recente na base
4. Registra aceitação com timestamp ISO 8601
5. Armazena ID e versão do termo aceito
6. Atualiza `first-access-control` com flag `mustAcceptTerms: false`
7. Retorna confirmação com data/hora

**Resposta (HTTP 200):**
```json
{
  "success": true,
  "acceptedAt": "2026-05-13T15:45:30.000Z",
  "termsVersion": "v1.0",
  "documentId": "abc123def456"
}
```

**Registros gerados:**
- Atualização de `acceptedTerms = true` no documento Municipe
- Histórico em `term-list` com versão e timestamp
- Evento em auditoria de segurança

---

### Revogar Consentimento

**Endpoint:** `PATCH /auth/onboarding/revoke-terms`

**Autenticação:** Requerida (JWT token)

**Payload:**
```json
{}
```

**Lógica implementada (`src/api/*/services/onboarding-revoke-terms.ts`):**

1. Valida se usuário está autenticado
2. Valida se usuário é do tipo Municipe
3. Remove consentimento (set `acceptedTerms = false`)
4. Limpa dados de aceitação (timestamps, IDs)
5. Reativa flag de obrigatoriedade (`mustAcceptTerms: true`)
6. Registra revogação em logs
7. Retorna confirmação

**Resposta (HTTP 200):**
```json
{
  "success": true,
  "revokedAt": "2026-05-13T15:47:00.000Z",
  "mustAcceptTerms": true
}
```

**Impacto:**
- Usuário volta a ter pendência de aceite de termos
- Acesso a funcionalidades restringido até novo aceite
- Evento registrado em auditoria

---

## 2. Direito de Retificação

### Atualizar Perfil

**Endpoint:** `PUT /edit-profile/:id`

**Autenticação:** Requerida (JWT token)

**Payload (campos permitidos):**
```json
{
  "telefone": "11999999999",
  "cep": "01234567",
  "endereco": "Rua Exemplo",
  "numero": "123",
  "complemento": "Apto 45",
  "dataNascimento": "1990-01-15"
}
```

**Campos BLOQUEADOS (não podem ser alterados):**
- `nome` - Impossível alterar
- `cpf` - Impossível alterar
- `email` - Impossível alterar
- `dataNascimento` - Impossível alterar (conforme código)
- `user` (vínculo de usuário) - Impossível alterar

**Restrições adicionais:**
- Usuário só pode atualizar seu próprio perfil
- Cadastro em status `AGUARDANDO_VALIDACAO` não pode ser alterado
- Cadastro em status `ARQUIVADO` não pode ser alterado

**Lógica implementada (`src/api/*/services/update-me.ts`):**

1. Valida autenticação do usuário
2. Valida que é o próprio perfil sendo alterado
3. Verifica status do cadastro (rejeita se aguardando validação ou arquivado)
4. Filtra apenas campos permitidos
5. Aplica normalização (remoção de caracteres, trim)
6. Criptografa campos sensíveis automaticamente (AES-256-GCM)
7. Atualiza documento
8. Registra alteração em auditoria

**Resposta (HTTP 200):**
```json
{
  "id": 42,
  "documentId": "abc123def456",
  "telefone": "11999999999",
  "cep": "01234567",
  "endereco": "Rua Exemplo",
  "numero": "123",
  "complemento": "Apto 45",
  "dataNascimento": "1990-01-15"
}
```

**Registros gerados:**
- Atualização de documento Municipe
- Evento em auditoria de segurança com campos alterados
- Criptografia automática de dados sensíveis

---

## 3. Direito ao Esquecimento (Exclusão de Dados)

### Deletar Conta e Dados Associados

**Endpoint:** `POST /auth/delete-account`

**Autenticação:** Requerida (JWT token)

**Payload:**
```json
{
  "currentPassword": "SenhaAtual123!"
}
```

**Validação de entrada:**
- `currentPassword`: obrigatório, mínimo 8 caracteres, confirmação de identidade

**Lógica implementada (`src/api/*/services/delete-account.ts`):**

1. Valida autenticação (requer JWT válido)
2. Valida que usuário é do tipo Municipe/Admin/Master
3. Valida senha atual (proteção contra exclusão acidental)
4. Deleta TODOS os dados associados ao usuário:
   - Documento Municipe/Admin/Master
   - Histórico de consentimento (`term-list`)
   - Dados de autenticação (`auth-security`)
   - Controle de primeiro acesso (`first-access-control`)
5. Deleta usuário na base de users-permissions
6. Revoga token JWT por 2 dias (impede reuso)
7. Registra exclusão em auditoria

**Resposta (HTTP 200):**
```json
{
  "deleted": true
}
```

**O que é deletado:**
- ✅ Documento do usuário (Municipe/Admin/Master)
- ✅ Termo-list (histórico de consentimentos)
- ✅ Auth-security (dados de 2FA, últimos logins, IPs)
- ✅ First-access-control (status de onboarding)
- ✅ Registro de user (users-permissions)
- ✅ Token JWT revogado

**O que NÃO é deletado:**
- Auditoria de segurança (intencionalmente preservada por 5 anos para conformidade legal)
- Eco-coins e transações (direito sobre propriedade/ativo digital)

**Registros gerados:**
- Evento de exclusão em auditoria de segurança (não pode ser deletado)
- Revogação de token registrada
- Timestamp de exclusão capturado

---

## 4. Direito de Acesso aos Dados

### Acesso via Auditoria de Segurança

**Implementação:** Eventos de acesso e atividade do usuário são registrados em tempo real

**Dados registrados para cada atividade:**
- `eventType`: tipo de evento (login, 2FA, reset senha, etc)
- `level`: severidade (info, warn, error)
- `message`: descrição legível
- `userId`: identificador do usuário
- `userEmailMasked`: email parcialmente mascarado (ex: `us***@example.com`)
- `ip`: endereço IP do cliente
- `userAgent`: navegador/app usado
- `timestamp`: data/hora ISO 8601
- `metadata`: contexto adicional (rememberMe, reason, expiresAt, etc)

**Eventos de acesso registrados:**
- ✅ Login bem-sucedido
- ✅ Tentativas de login falhadas
- ✅ 2FA desafiado
- ✅ 2FA bem-sucedido
- ✅ 2FA falhado
- ✅ Reset de senha solicitado
- ✅ Senha resetada
- ✅ Alteração de perfil
- ✅ Exclusão de conta
- ✅ Consentimento aceito
- ✅ Consentimento revogado

**Acesso aos logs:**
- Requer acesso administrativo ao banco de dados
- Logs possuem hash encadeado e assinatura HMAC para integridade
- Logs não podem ser deletados ou alterados (proteção por lifecycle)

---

## 5. Fluxos de Atendimento de Direitos (Resumo)

### Fluxo 1: Usuário quer aceitar termos
```
1. POST /auth/local → Login com 2FA
2. PATCH /auth/onboarding/accept-terms → Aceita termos
3. Retorna sucesso e timestamp
4. Evento registrado em auditoria
```

### Fluxo 2: Usuário quer revogar consentimento
```
1. POST /auth/local → Login com 2FA
2. PATCH /auth/onboarding/revoke-terms → Revoga termos
3. Retorna sucesso e reativa obrigatoriedade de aceite
4. Evento registrado em auditoria
```

### Fluxo 3: Usuário quer corrigir seus dados
```
1. POST /auth/local → Login com 2FA
2. GET /edit-profile/:id → Busca dados atuais (opcional)
3. PUT /edit-profile/:id → Envia apenas campos permitidos
4. Retorna dados atualizados
5. Evento registrado em auditoria
6. Dados são criptografados automaticamente
```

### Fluxo 4: Usuário quer deletar sua conta
```
1. POST /auth/local → Login com 2FA
2. POST /auth/delete-account → Envia senha atual como confirmação
3. Sistema deleta todos os dados do usuário
4. Retorna confirmação
5. Token é revogado por 2 dias
6. Evento registrado em auditoria (não pode ser deletado)
```

---

## 6. Proteções Implementadas

### Criptografia de Dados Sensíveis
- Todos os campos alteráveis via `/edit-profile` são criptografados com AES-256-GCM
- Chave gerenciada via variável de ambiente `DATA_ENCRYPTION_KEY`
- Cada valor tem IV (vetor de inicialização) aleatório

### Integridade de Auditoria
- Hash encadeado: cada evento contém hash do anterior
- Assinatura HMAC com `AUDIT_LOG_SECRET`
- Impossível alterar ou deletar logs (proteção por lifecycle)

### Autenticação
- Todos os endpoints de direitos requerem JWT válido
- Exclusão requer confirmação de senha (segunda autenticação)
- 2FA obrigatório para login

### Rastreabilidade
- Cada ação registra IP, User-Agent, timestamp
- Email mascarado nos logs (apenas 2 primeiros chars visíveis)
- Eventos estruturados para análise de conformidade

---

## 7. Conformidade Legal

**Direitos LGPD cobertos:**
- Artigo 15: Direito de acesso (via auditoria de segurança)
- Artigo 16: Direito de retificação (via `/edit-profile`)
- Artigo 17: Direito ao esquecimento (via `/delete-account`)
- Artigo 8: Consentimento (via `/accept-terms`, `/revoke-terms`)

**Recomendações operacionais (fora do escopo do código):**
- Implementar Dashboard de suporte para consultar auditoria
- Estabelecer SLA de 10 dias para atendimento de direitos
- Documentar políticas de retenção de dados (incluindo exceções de auditoria)
- Integrar com SIEM para monitoramento contínuo
- Realizar DPA (Data Protection Impact Assessment) anualmente

---

## 8. Endpoints Consolidados por Módulo

Todos os 3 módulos (Municipe, Admin, Master) possuem:

| Endpoint | Método | Função | Autenticação |
|----------|--------|--------|----------------|
| `/auth/onboarding/accept-terms` | PATCH | Aceitar termos | Requerida |
| `/auth/onboarding/revoke-terms` | PATCH | Revogar consentimento | Requerida |
| `/edit-profile/:id` | PUT | Atualizar perfil | Requerida |
| `/auth/delete-account` | POST | Deletar conta | Requerida + senha |

---

## 9. Referências de Implementação

**Serviços:**
- `src/api/*/services/onboarding-accept-terms.ts`
- `src/api/*/services/onboarding-revoke-terms.ts`
- `src/api/*/services/update-me.ts`
- `src/api/*/services/delete-account.ts`

**Criptografia:**
- `src/utils/data-protection.ts` (AES-256-GCM)

**Auditoria:**
- `src/utils/security-audit-log.ts`

**Content-types:**
- `src/api/*/content-types/*/schema.json`
- `src/api/*/content-types/*/lifecycles.ts`

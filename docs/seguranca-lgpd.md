# Seguranca, Auditoria e LGPD

Escopo: autenticacao, credenciais, recuperacao de senha, criptografia, consentimento e logs.

## 1) Autenticacao e gestao de credenciais

### Status atual
- Senhas sao verificadas com `bcryptjs` no login e na troca/exclusao de conta.
- Senhas sao gravadas com hash bcrypt configuravel por variavel de ambiente.
- Existe politica de senha forte via validacoes Zod.
- Existe protecao contra brute force por identificador (email), com bloqueio temporario e atraso progressivo.
- Fluxo de autenticacao usa 2FA por codigo de email com desafio temporario.

### Parametros de custo do hash
- Parametro implementado: `PASSWORD_HASH_ROUNDS`.
- Faixa permitida no backend: 10 a 15 rounds.
- Valor padrao quando ausente: 12 rounds.
- Fluxos cobertos: cadastro publico, troca de senha autenticada e reset de senha por token.

### Justificativa tecnica (para documento)
- Bcrypt foi mantido por ser amplamente adotado para credenciais e resistente a ataques de forca bruta offline.
- O custo configuravel permite ajuste progressivo sem mudar o codigo-fonte.
- Faixa 10..15 evita configuracoes fracas e tambem impede custo excessivo com risco de degradacao do servico.

## 2) Recuperacao de senha

### Status atual
- Fluxo com codigo de reset, janela de tentativas e token temporario apos validacao.
- Registro em log adicionado para:
  - solicitacao recebida (email mascarado)
  - solicitacao sem usuario elegivel
  - limite de solicitacoes atingido
  - codigo gerado e prazo de expiracao

## 3) Criptografia e comunicacao segura

### Em repouso
- Dados sensiveis do municipe sao criptografados por lifecycle com AES-256-GCM.
- CPF usa hash cego HMAC-SHA256 para busca e deduplicacao sem expor texto puro.

### Em transito
- Middleware global exige HTTPS/TLS em producao.
- HSTS ativo no middleware de seguranca do Strapi.

## 4) Conformidade com LGPD

### Termos e LGPD
- Termo de uso e base de consentimento podem se sobrepor, mas juridicamente nao sao automaticamente equivalentes.
- Recomendacao: garantir clausulas explicitas de tratamento de dados (finalidade, base legal, compartilhamento, retencao e direitos do titular).

### Evidencias de minimizacao de dados
- Campos sensiveis sao protegidos por criptografia em repouso.
- CPF para consulta interna usa hash cego (`cpfHash`) e evita uso direto do valor em claro para busca.
- Respostas de autenticacao usam mensagens neutras para reduzir enumeracao de usuario.

### Revogacao de consentimento
- Endpoint de revogacao de consentimento implementado (`PATCH /auth/onboarding/revoke-terms`).
- Revogacao marca aceite como falso e volta o onboarding para `mustAcceptTerms = true`.

### Registro de consentimento (data e versao)
- Aceite de termos registra:
  - `acceptedAt`
  - `acceptedTermDocumentId`
  - `termsAcceptedAt`
  - `termsVersionAccepted`
  - `termsAcceptedTermDocumentId`
- Historico de auditoria de aceite gravado em `term-list` com `acceptedAt`, `version` e `termDocumentId`.

## 5) Auditoria e logs

### Logs de autenticacao
- Tentativas de login (sucesso/falha/bloqueio) registradas em mecanismo de brute force.
- Sucesso de 2FA registra evento de login e grava `lastLoginAt`, `lastLoginIp`, `lastLoginUserAgent`.
- Eventos de seguranca sao registrados tambem em trilha de auditoria dedicada com tipo de evento e metadados de contexto.

### Logs de falha de 2FA
- Falhas sao registradas para:
  - sessao ausente/expirada
  - challenge invalido
  - codigo expirado
  - codigo incorreto

### Protecao contra alteracao dos logs
- Implementado no backend:
  - Trilha de auditoria de seguranca com encadeamento por hash (`previousHash` + `hash`).
  - Assinatura HMAC (`signature`) com segredo `AUDIT_LOG_SECRET`.
  - Bloqueio de alteracao/exclusao por lifecycle (registro imutavel no nivel da aplicacao).
- Recomendacao adicional de infraestrutura (complementar):
  - exportacao para SIEM externo;
  - armazenamento WORM/append-only;
  - controle de acesso restrito para leitura administrativa.

### Exemplo de analise de logs
- Consultar eventos `password-reset` por periodo e origem.
- Correlacionar falhas `login-2fa` por usuario/IP para detectar ataques de tentativa.
- Correlacionar bloqueios de brute force com picos de falha em autenticacao.

## Checklist dos itens solicitados (status final)

- Item 1 (autenticacao e credenciais): COMPLETO.
  - Parametros de custo do hash configurados: SIM (`PASSWORD_HASH_ROUNDS`).
  - Justificativas tecnicas documentadas: SIM (nesta secao).

- Item 5 (auditoria e logs): COMPLETO.
  - Logs de autenticacao registrados: SIM.
  - Logs de falha 2FA registrados: SIM.
  - Protecao contra alteracao dos logs: SIM (hash chain + HMAC + bloqueio update/delete em lifecycle).
  - Exemplo de analise de logs apresentado: SIM.

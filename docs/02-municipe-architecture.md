# Módulo Municipe - Arquitetura e Design (Estado Atual)

Este documento descreve o que está implementado no código do módulo munícipe.

## Estrutura do módulo

- `content-types`: definição de schema e lifecycles.
- `controllers`: camada HTTP para entrada e resposta.
- `routes`: mapeamento de endpoints.
- `services`: regras de negócio.
- `validation`: schemas Zod.
- `helpers`: utilitários internos dos fluxos.

## Content-Type `municipe`

### Características
- Collection Type.
- `draftAndPublish: false`.
- Relação 1:1 com `plugin::users-permissions.user`.

### Campos relevantes
- Identificação e contato: `nome`, `cpf`, `dataNascimento`, `telefone`, `cep`, `endereco`, `numero`, `complemento`, `cidade`, `estado`, `imagemUrl`.
- Segurança de busca: `cpfHash` (privado, único).
- Consentimento: `acceptedTerms`, `acceptedTermDocumentId`, `acceptedAt`.

### Tratamento de dados sensíveis
- Campos sensíveis são tratados via lifecycle do munícipe.
- `cpfHash` é hash determinístico para busca/deduplicação.

## Fluxos funcionais implementados

### Registro público
- Endpoint: `POST /register/municipes`.
- Validação com Zod.
- Verifica duplicidade de e-mail e CPF.
- Cria usuário no users-permissions.
- Cria registro de munícipe.

### Autenticação com 2FA
- Passo 1: `POST /auth/local`
  - Valida credenciais.
  - Aplica proteção de brute-force.
  - Gera código de 6 dígitos com expiração.
  - Persiste desafio em `auth-security`.
- Passo 2: `POST /auth/local/verify-code`
  - Valida `email`, `code` e `challengeId`.
  - Limpa dados do desafio após sucesso.
  - Emite JWT com validade de 1 dia ou 30 dias (`rememberMe`).

### Onboarding
- `GET /auth/onboarding/status`: calcula pendências.
- `PATCH /auth/onboarding/accept-terms`: registra consentimento e histórico.
- `PATCH /auth/onboarding/revoke-terms`: revoga consentimento.
- `PUT /edit-profile/:id`: permite atualização apenas de campos autorizados.

### Senha
- `POST /auth/change-password`: troca autenticada com validação de política.
- `POST /auth/request-password-reset`: inicia fluxo de recuperação por e-mail.
- `POST /auth/password-reset/validate-code`: valida código e gera `resetToken` temporário.
- `PATCH /auth/reset-password`: conclui redefinição e invalida estado temporário.

### Encerramento de sessão e conta
- `POST /auth/logout`: revoga token atual na blacklist interna.
- `POST /auth/delete-account`: valida senha e remove usuário/entidades relacionadas no módulo.

## Camadas de suporte no domínio

- `auth-security`: estado operacional de autenticação (2FA, confirmação, reset, último login).
- `first-access-control`: estado de onboarding e recuperação de senha.
- `term-list`: trilha de aceite de termos por versão/documento.
- `brute-force-attempt`: persistência de tentativas por identificador.
- `revoked-token`: blacklist de tokens revogados.

## Observações de contrato relevantes

- Endpoint público `PATCH /auth/onboarding/accept-terms/public` valida termo ativo e retorna metadados; não grava aceite.
- O perfil do usuário é servido pelo endpoint `GET /users/me` (plugin users-permissions estendido), com inclusão de `profile` do munícipe.
- Existem handlers de confirmação de e-mail em controller/service do módulo, mas sem rota customizada explícita no arquivo de rotas do munícipe.
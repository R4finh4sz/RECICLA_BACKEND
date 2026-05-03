# 🌿 Recicla Online — Backend

> API backend do projeto **Recicla Online**, desenvolvida com [Strapi v5](https://strapi.io/) e TypeScript. Responsável por toda a lógica de negócio, autenticação segura, criptografia de dados sensíveis e comunicação com o banco de dados.

---

## Sumário

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias](#tecnologias)
- [Módulos da API](#módulos-da-api)
- [Arquitetura](#arquitetura)
- [Segurança](#segurança)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Execução](#instalação-e-execução)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Rotas da API](#rotas-da-api)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Equipe](#equipe)

---

## Sobre o Projeto

O **Recicla Online** é um sistema para gestão de reciclagem urbana que permite a munícipes realizarem cadastro, autenticação e acompanhamento de transações de eco-coins — uma moeda digital de recompensa por reciclagem. Este repositório contém o backend da aplicação, desenvolvido como parte do Projeto Integrador de Segurança da Informação do curso de Bacharelado em Engenharia de Software da Universidade de Mogi das Cruzes (UMC).

---

## Tecnologias

| Tecnologia | Versão | Finalidade |
|---|---|---|
| [Strapi](https://strapi.io/) | 5.36.0 | CMS headless / framework de API |
| TypeScript | ^5 | Tipagem estática |
| Node.js | >=20.x | Runtime |
| PostgreSQL | — | Banco de dados em produção |
| SQLite (better-sqlite3) | — | Banco de dados em desenvolvimento |
| bcryptjs | ^3.0.3 | Hash de senhas |
| Zod | ^4.3.6 | Validação de schemas |
| Nodemailer | ^8.0.1 | Envio de e-mails (2FA e reset de senha) |
| PDFKit | ^0.18.0 | Geração de PDFs (termos de uso) |
| DigitalOcean | — | Infraestrutura de produção |

### Plugins Strapi

| Plugin | Finalidade |
|---|---|
| `@strapi/plugin-users-permissions` | Autenticação e controle de acesso via JWT |
| `@strapi/plugin-documentation` | Geração automática de documentação da API |
| `@strapi/email` + `@strapi/provider-email-nodemailer` | Envio de e-mails transacionais |

---

## Módulos da API

Todos os módulos estão em `src/api/`:

| Módulo | Descrição |
|---|---|
| `municipe` | Entidade principal do usuário cidadão — cadastro, perfil, autenticação |
| `auth-security` | Controle de desafios 2FA |
| `first-access-control` | Primeiro acesso e fluxo de reset de senha |
| `revoked-token` | Registro de tokens JWT revogados (logout e exclusão de conta) |
| `brute-force-attempt` | Registro de tentativas de login para controle de bloqueio |
| `eco-coin` | Carteira de eco-coins do munícipe |
| `eco-coin-transaction` | Histórico de transações de eco-coins |
| `termo` / `term-list` | Termos de uso e controle de aceite |
| `trade-item` | Itens disponíveis para resgate na loja |
| `security-audit-log` | Auditoria de eventos de segurança com IP e User-Agent |

---

## Arquitetura

O backend segue a estrutura padrão do Strapi v5, organizada em **Content Types** (entidades) e estendida com serviços customizados de segurança:

```
src/
├── api/
│   ├── municipe/              # Entidade principal do usuário cidadão
│   │   ├── services/          # Lógica de negócio (auth, 2FA, reset, etc.)
│   │   ├── routes/            # Definição de rotas customizadas
│   │   └── validation/        # Schemas Zod de validação
│   ├── auth-security/         # Controle de desafios 2FA
│   ├── first-access-control/  # Controle de primeiro acesso e reset de senha
│   ├── revoked-token/         # Tabela de tokens revogados
│   ├── brute-force-attempt/   # Tabela de tentativas de login
│   ├── eco-coin/              # Carteira de eco-coins
│   ├── eco-coin-transaction/  # Transações de eco-coins
│   ├── termo/                 # Termos de uso
│   ├── term-list/             # Listagem de termos
│   ├── trade-item/            # Itens da loja
│   └── security-audit-log/    # Log de auditoria de segurança
├── middlewares/
│   ├── auth-checker.ts            # Verifica revogação de tokens JWT
│   ├── brute-force-protection.ts  # Proteção contra força bruta
│   ├── force-https.ts             # Força HTTPS em produção
│   └── remove-api-prefix.ts       # Normalização de prefixo de rotas
└── utils/
    ├── data-protection.ts     # Criptografia/descriptografia de campos sensíveis
    ├── password-hash.ts       # Abstração de hash de senha (bcrypt)
    └── security-audit-log.ts  # Log de auditoria com mascaramento de PII
```

---

## Segurança

Este projeto implementa múltiplas camadas de segurança alinhadas à **LGPD** e às boas práticas de Segurança da Informação.

### Autenticação e Gestão de Credenciais

- **Hash de senha com bcrypt** — salt configurável, sem armazenamento de senha em texto puro.
- **Autenticação em dois fatores (2FA)** — após login com senha, um código de 6 dígitos com tempo de expiração curto é enviado ao e-mail do munícipe.
- **JWT com revogação** — tokens são revogados explicitamente no logout e na exclusão de conta, registrados na tabela `revoked-token`.
- **Sessões com expiração** — JWTs possuem tempo de vida configurado.
- **Proteção contra força bruta** — bloqueio temporário de 15 minutos e atraso progressivo após tentativas de login falhas, registradas na tabela `brute-force-attempt`.

### Criptografia e Comunicação Segura

- **TLS/HTTPS forçado** — middleware redireciona GET/HEAD para HTTPS (status 308) e bloqueia métodos de escrita em HTTP (status 426 Upgrade Required).
- **Criptografia de dados em repouso** — campos sensíveis do munícipe (`cpf`, `telefone`, `cep`, `endereco`, `numero`, `complemento`) são criptografados automaticamente via lifecycle hooks antes de persistir no banco.
- **Hash cego do CPF (`cpfHash`)** — permite validação de duplicidade sem expor o CPF em texto puro. Marcado como `private` no schema.

### Recuperação de Senha

Fluxo em 3 etapas com proteção contra enumeração de contas:

1. **Solicitação** — gera código numérico de 6 dígitos (validade: 10 min) e envia por e-mail. Retorna resposta genérica `{ sent: true }` independente de o e-mail existir ou não.
2. **Validação do código** — confere o código e emite um `resetToken` temporário (UUID, validade: 15 min).
3. **Reset** — aceita `resetToken` + nova senha, aplica hash e limpa todos os campos temporários.

### Requisitos de Segurança

| # | Tipo | Descrição |
|---|---|---|
| RF-01 | Funcional | Normalização de dados pessoais antes de persistir |
| RF-02 | Funcional | Hash cego do CPF para busca sem exposição |
| RF-03 | Funcional | Criptografia de campos sensíveis em repouso |
| RF-04 | Funcional | Descriptografia controlada no pós-leitura |
| RF-05 | Funcional | Proteção contra brute force no login |
| RF-06 | Funcional | Emissão de desafio 2FA após senha válida |
| RF-07 | Funcional | JWT emitido somente após validação do 2FA |
| RF-08 | Funcional | Reenvio de 2FA apenas com desafio válido |
| RF-09 | Funcional | Recuperação de senha em 3 etapas |
| RF-10 | Funcional | Revogação de token ao excluir conta |
| RNF-01 | Não-Funcional | Sem enumeração de contas em endpoints públicos |
| RNF-02 | Não-Funcional | Rate limiting por janela em operações críticas |
| RNF-03 | Não-Funcional | TTL obrigatório para códigos e tokens temporários |
| RNF-04 | Não-Funcional | Mensagens de erro neutras em falhas de autenticação |
| RNF-05 | Não-Funcional | Auditoria com IP e User-Agent |
| RNF-06 | Não-Funcional | Mascaramento de dados pessoais nos logs |
| RNF-07 | Não-Funcional | `cpfHash` marcado como privado no schema |
| RNF-08 | Não-Funcional | Atualização de perfil por allowlist (menor privilégio) |
| RNF-09 | Não-Funcional | Limpeza de tokens/códigos após uso |
| RNF-10 | Não-Funcional | Controles dependentes de role `Municipe` |

---

## Pré-requisitos

- **Node.js** >= 20.x
- **npm** >= 6.x
- **PostgreSQL** (produção) ou SQLite (desenvolvimento, configurado automaticamente)

---

## Instalação e Execução

```bash
# 1. Clone o repositório
git clone https://github.com/R4finh4sz/RECICLA_BACKEND.git
cd RECICLA_BACKEND

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# 4. Execute em modo de desenvolvimento
npm run dev

# 5. Build para produção
npm run build
npm run start
```

### Scripts disponíveis

```bash
npm run dev        # Desenvolvimento com hot-reload
npm run build      # Build do admin + API
npm run start      # Produção
npm run strapi     # CLI do Strapi
npm run upgrade    # Atualiza o Strapi para a versão mais recente
```

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Servidor
HOST=0.0.0.0
PORT=1337

# Segurança Strapi
APP_KEYS=sua_chave_1,sua_chave_2
API_TOKEN_SALT=seu_salt
ADMIN_JWT_SECRET=seu_secret
TRANSFER_TOKEN_SALT=seu_salt
JWT_SECRET=seu_jwt_secret

# Banco de Dados
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=recicla
DATABASE_USERNAME=seu_usuario
DATABASE_PASSWORD=sua_senha
DATABASE_SSL=false

# E-mail (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_de_app

# Criptografia de dados sensíveis
ENCRYPTION_KEY=sua_chave_de_criptografia_32bytes

# HTTPS
FORCE_HTTPS=false  # true em produção
```

> ⚠️ **Nunca** versione o arquivo `.env`. Ele já está incluído no `.gitignore`.

---

## Rotas da API

### Autenticação

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| POST | `/auth/local` | Login — gera desafio 2FA | Público |
| POST | `/auth/local/verify-code` | Valida código 2FA e emite JWT | Público |
| POST | `/auth/local/resend-code` | Reenvia código 2FA | Público |
| POST | `/auth/change-password` | Troca de senha | 🔒 Requer JWT |
| POST | `/auth/logout` | Logout e invalidação de token | 🔒 Requer JWT |

### Recuperação de Senha

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| POST | `/auth/request-password-reset` | Solicita código de reset por e-mail | Público |
| POST | `/auth/password-reset/validate-code` | Valida código e retorna `resetToken` | Público |
| PATCH | `/auth/reset-password` | Redefine senha usando `resetToken` | Público |

### Munícipe

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| POST | `/autoregister/municipes` | Cadastro de novo munícipe | Público |
| GET | `/auth/me` | Dados do munícipe autenticado | 🔒 Requer JWT |
| PATCH | `/auth/me` | Atualiza perfil (campos permitidos) | 🔒 Requer JWT |
| DELETE | `/auth/delete-account` | Exclui conta e revoga token | 🔒 Requer JWT |

### Eco-Coins e Termos

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| GET | `/eco-coin/me` | Consulta saldo de eco-coins | 🔒 Requer JWT |
| POST | `/eco-coin/redeem` | Resgata eco-coins | 🔒 Requer JWT |
| GET | `/eco-coin-transaction/me` | Histórico de transações | 🔒 Requer JWT |
| GET | `/autoregister/termos/active` | Termos de uso vigentes | Público |

---

## Estrutura de Pastas

```
RECICLA_BACKEND/
├── config/                  # Configurações do Strapi (db, server, plugins)
├── database/
│   └── migrations/          # Migrações de banco de dados
├── docs/                    # Documentação técnica adicional
│   ├── cryptography-and-tls.md
│   └── seguranca-lgpd.md
├── public/                  # Arquivos públicos estáticos
├── src/
│   ├── admin/               # Customizações do painel admin
│   ├── api/                 # Content types e serviços de negócio
│   ├── extensions/          # Extensões de plugins Strapi
│   ├── middlewares/         # Middlewares de segurança
│   ├── policies/            # Políticas de acesso por role
│   └── utils/               # Utilitários (criptografia, hash, audit log)
├── types/                   # Tipos gerados pelo Strapi
├── .env.example             # Modelo de variáveis de ambiente
├── package.json
└── tsconfig.json
```

---

## Equipe

| Nome | RGM |
|---|---|
| Gustavo Di Risio | 11231101211 |
| Graziela Pereira de Oliveira | 11231103878 |
| Rayane da Luz Barbosa | 11221103247 |
| Rafael Souza Santana | 11231100972 |

**Disciplina:** Segurança da Informação — Bacharelado em Engenharia de Software
**Instituição:** Universidade de Mogi das Cruzes (UMC)
**Professor:** Fabiano Menegidio

---

> 📄 Documentação adicional disponível em [`/docs`](./docs)


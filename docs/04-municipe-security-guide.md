# Municipe - Guia de Segurança (Implementação Atual)

Este guia descreve os mecanismos de segurança efetivamente implementados no código.

## Criptografia em repouso

- Campos sensíveis do munícipe são tratados com AES-256-GCM via lifecycle.
- O formato inclui versionamento/prefixo e metadados de criptografia (IV e tag).
- Campos do domínio munícipe protegidos: CPF, telefone, CEP, endereço, número e complemento.

## Hash de CPF para busca segura

- O sistema mantém `cpfHash` como hash determinístico para deduplicação e busca.
- O hash é separado do campo `cpf`, que é tratado como dado sensível em repouso.

## Proteção contra brute-force

- Há bloqueio temporário por identificador com persistência em `brute-force-attempt`.
- Implementação atual:
  - Contagem máxima: 5 tentativas falhas.
  - Bloqueio ocorre ao atingir 5 tentativas.
  - Janela de bloqueio: 15 minutos.
  - Delay progressivo antes do bloqueio final: `500ms * tentativas`.

## Two-Factor Authentication (2FA)

- Código de 6 dígitos com expiração de 10 minutos.
- Desafio vinculado por `challengeId`.
- Verificação exige `email + code + challengeId`.
- Em sucesso, o estado temporário de 2FA é limpo.

## Política de senha

- Validação de senha forte em cadastro, troca e reset.
- Regras validadas por schemas/helpers no backend.

## JWT e revogação

- O login 2FA emite JWT com validade:
  - padrão: 1 dia
  - rememberMe: 30 dias
- Revogação de sessão é implementada por blacklist interna (`revoked-token`) e verificação em middleware (`auth-checker`).

## Consentimento e LGPD

- `PATCH /auth/onboarding/accept-terms` registra consentimento no perfil e histórico em `term-list`.
- `PATCH /auth/onboarding/revoke-terms` revoga consentimento e reabre pendência de onboarding.
- A trilha de consentimento registra versão e referência do termo aceito.

## Auditoria de segurança

- Eventos de segurança são registrados em trilha dedicada.
- A trilha possui proteção de integridade por hash encadeado e assinatura HMAC.
- Lifecycle impede alteração e exclusão do audit log no nível da aplicação.

## Logs e mascaramento

- Fluxos sensíveis registram contexto de segurança (incluindo IP e user-agent em eventos auditados).
- E-mail é mascarado em eventos de risco para reduzir exposição de dados.

## Segurança de transporte

- Forçamento de HTTPS em ambiente aplicável.
- HSTS habilitado na configuração de segurança.

## Pontos de atenção documentais

- Este guia descreve somente o comportamento implementado.
- Itens operacionais de infraestrutura (SIEM, WORM, monitoramento avançado, resposta a incidentes) são recomendações e não implementação direta do código desta base.
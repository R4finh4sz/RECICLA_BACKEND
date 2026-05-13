# Segurança, Auditoria e LGPD (Status de Implementação)

Escopo: autenticação, credenciais, recuperação de senha, criptografia, consentimento e logs.

## 1) Autenticação e gestão de credenciais

### Implementado
- Verificação de senha com `bcryptjs` em login, troca de senha e exclusão de conta.
- Gravação de senha com hash bcrypt em cadastro/troca/reset.
- Política de senha forte validada no backend.
- Proteção de brute-force por identificador com bloqueio temporário e delay progressivo.
- Login com 2FA por código de e-mail e desafio temporário.

### Observação
- Regras detalhadas de claims JWT e blacklist em Redis não representam o contrato atual desta base.

## 2) Recuperação de senha

### Implementado
- Fluxo com solicitação de código, validação de código e redefinição final.
- Registro de eventos de segurança no fluxo de recuperação.
- Janela de solicitação implementada no código: até 3 por 1 hora.
- Código de recuperação com expiração curta; após validação, emissão de `resetToken` temporário.

## 3) Criptografia e comunicação segura

### Em repouso
- Campos sensíveis de munícipe protegidos via lifecycle com AES-256-GCM.
- CPF com hash determinístico (`cpfHash`) para busca/deduplicação sem expor valor original.

### Em trânsito
- Middleware global de forçamento de HTTPS.
- HSTS habilitado na configuração de segurança.

## 4) Conformidade com LGPD

### Consentimento
- Aceite de termos autenticado persistido no perfil do munícipe.
- Histórico de aceite persistido em `term-list` com versão/documento/timestamp.
- Revogação de consentimento implementada (`PATCH /auth/onboarding/revoke-terms`).

### Minimização de dados
- Dados sensíveis protegidos em repouso.
- Uso de hash para CPF em buscas internas.
- Mensagens de autenticação sem detalhamento excessivo de existência de usuário em parte dos fluxos.

### Observação
- Este documento descreve implementação de software. Aspectos jurídicos de base legal, retenção e direitos do titular devem ser tratados em políticas institucionais e documentação legal.

## 5) Auditoria e logs

### Implementado
- Registro de eventos de autenticação, 2FA e recuperação de senha em trilha dedicada.
- Registro de último login (`lastLoginAt`, `lastLoginIp`, `lastLoginUserAgent`) após sucesso do 2FA.
- Registro de falhas de 2FA (sessão ausente, challenge inválido, código expirado, código incorreto).
- Integridade de logs com hash encadeado e assinatura HMAC.
- Bloqueio de alteração/exclusão de audit log por lifecycle.

### Recomendações operacionais (fora do código)
- Integração com SIEM externo.
- Armazenamento WORM/append-only.
- Controles de acesso administrativos mais restritivos para trilha de auditoria.

## Checklist técnico (factual)

- Autenticação e credenciais: implementado com observações contratuais.
- Recuperação de senha: implementado com janelas/TTL definidos no código.
- Criptografia em repouso e TLS/HSTS: implementado.
- Consentimento e revogação: implementado.
- Auditoria e proteção de logs: implementado.

Este arquivo substitui classificações absolutas de "completo" por status factual orientado ao código atual.
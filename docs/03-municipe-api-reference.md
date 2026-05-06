# Municipe - Referência de API

Base URL: https://api.recicla.com.br/api

Autenticação: Incluir JWT no header Authorization: Bearer <jwt_token>

Erros: Retornam com status HTTP apropriado, nome do erro e mensagem em português.

## Endpoints Públicos

**POST /register/municipes** - Registrar novo municipe. Requer nome, email, password forte, CPF válido e endereço completo. Valida duplicidade de email e CPF. Cria user em users-permissions e municipe com dados encriptados.

**POST /auth/local** - Requisitar código 2FA por email. Requer email e password. Valida brute-force, gera code 6-digit, salva challenge e envia por email. Retorna challengeId.

**POST /auth/local/verify-code** - Verificar código 2FA e obter JWT. Requer email, code e challengeId. Valida correspondência, gera JWT com expiração (1 dia ou 30 dias com rememberMe).

**POST /auth/local/resend-code** - Resolicitar código 2FA. Requer email. Rate limited a 5 reenvios por 10 minutos.

**POST /auth/request-password-reset** - Enviar link de reset para email. Requer email. Rate limited a 3 requisições por 10 minutos. Resposta genérica por segurança.

**POST /auth/password-reset/validate-code** - Validar token de reset. Requer resetToken. Verifica validade (1 hora).

**PATCH /auth/reset-password** - Definir nova senha. Requer resetToken, newPassword e confirmPassword. Valida força de password. Revoga todos os tokens existentes após sucesso.

**POST /auth/confirm-email-code** - Confirmar email com código. Requer email e code 6-digit.

**POST /auth/resend-email-confirmation-code** - Reenviar código de confirmação. Requer email. Rate limited a 5 requisições por 10 minutos.

**PATCH /auth/onboarding/accept-terms/public** - Aceitar termos antes de login. Sem parâmetros. Registra aceitação.

## Endpoints Autenticados

**GET /auth/onboarding/status** - Verificar status de onboarding. Retorna se faltam: perfil, termos ou password.

**PATCH /auth/onboarding/accept-terms** - Registrar aceitação de termos. Sem parâmetros. Registra em term-list para auditoria.

**PATCH /auth/onboarding/revoke-terms** - Revogar consentimento de termos. Sem parâmetros.

**GET /municipes/me** - Obter perfil do usuário logado. Sem parâmetros.

**PUT /edit-profile/:id** - Atualizar perfil. Parâmetro URL: :id do municipe. Pode editar: complemento, endereco, cep, cidade, telefone. Campos imutáveis: nome, cpf, email, dataNascimento, estado.

**POST /auth/change-password** - Alterar senha. Requer currentPassword, newPassword e confirmPassword. Valida força de password.

**POST /auth/delete-account** - Deletar conta permanentemente. Requer currentPassword para confirmação de identidade. Remove municipe, user e histórico.

**POST /auth/logout** - Fazer logout. Sem parâmetros. Revoga token adicionando à blacklist.

## Fluxo de Uso

Registro: POST /register/municipes → Login Passo 1: POST /auth/local → Login Passo 2: POST /auth/local/verify-code → Obter JWT → GET /auth/onboarding/status → PUT /edit-profile (se necessário) → PATCH /auth/onboarding/accept-terms → Usar API.


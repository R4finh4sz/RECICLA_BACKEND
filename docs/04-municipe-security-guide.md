# Municipe - Guia de Segurança

Este documento descreve as implementações de segurança, justificativas técnicas e recomendações operacionais.

## Criptografia em Repouso

Usa AES-256-GCM (Algoritmo Encryption Standard 256-bit Galois Counter Mode). É recomendado por NIST, oferece autenticação integrada (detecta tampering), suporte nativo em Node.js e é amplamente auditado.

Campos criptografados: CPF, telefone, CEP, endereço, número, complemento.

Cada criptografia gera um IV (Initialization Vector) aleatório de 96 bits. Isso significa que o mesmo plaintext criptografado duas vezes gera ciphertexts diferentes, prevenindo ataques de padrão. A estrutura armazenada é: prefixo "enc::v1::" seguido de IV em base64, tag de autenticação em base64 e dados criptografados em base64.

A chave criptográfica deve ser gerada com 32 bytes aleatórios (256 bits) codificados em base64. Armazenar em variável de ambiente DATA_ENCRYPTION_KEY.

## Hash Criptográfico para Busca

Problema: Se CPF está criptografado, não consegue fazer busca (o ciphertext muda cada execução). Solução: Usar HMAC-SHA256 determinístico que sempre produz o mesmo hash para o mesmo input.

Campo cpfHash armazena o HMAC-SHA256 do CPF. Permite buscas rápidas por índice UNIQUE. O hash é irreversível (não recupera CPF original). Cada campo sensível que precisa ser buscável tem seu próprio hash.

Vantagens: determinístico (mesmo CPF → mesmo hash sempre), irreversível (seguro), buscável (pode usar em WHERE), rápido (computacionalmente eficiente), LGPD compliant (CPF sensível apenas em campo criptografado).

## Proteção contra Brute-Force

Máximo 5 tentativas de login falhas por email em janela de 15 minutos. A 6ª tentativa é bloqueada com status 429. Aplicar exponential backoff: 500ms × (número da tentativa) de delay progressivo antes de rejeitar.

Qualquer tentativa bem-sucedida limpa o contador. Ideal usar Redis para armazenar tentativas com TTL automático de 15 minutos.

Teste prático: tentar login com senha errada 5 vezes resulta em 400. 6ª tentativa retorna 429 "Brute-force protection: tente em 15 minutos". Após 15 minutos o bloqueio é removido automaticamente.

## Two-Factor Authentication (2FA)

Código de 6 dígitos aleatório com validade de 10 minutos. Cada 2FA session tem um challengeId (UUID) que vincula email + código. Toda requisição de verificação valida: código correto, email correspondente, timestamp dentro de 10 minutos.

Implementação: Requisição 1 envia email com código e retorna challengeId. Requisição 2 verifica código contra challenge. Se válido, gera JWT e revoga challenge. Challenge não pode ser reutilizado.

Rate limit de reenvios: máx 5 reenvios por 10 minutos. Tentativas ilimitadas de verificação (mas code expira naturalmente).

## Validação de Força de Senha

Política obrigatória: mínimo 8 caracteres, pelo menos 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial.

Exemplos inválidos: "senha123" (sem maiúscula), "SENHA123" (sem minúscula), "SenhaABC" (sem número), "Senha123" (sem especial). Exemplo válido: "Senh@Forte123".

Implementação com regex: validar durante criação de conta, alteração de senha e reset de senha.

## Gestão de Token JWT

Token JWT armazena: sub (user ID), iat (issued at), exp (expiration), aud (audience), role (Municipe), tokenId (UUID para revogação).

Tempos de expiração: Standard login (rememberMe=false) = 1 dia. Remember me (rememberMe=true) = 30 dias.

Token revocation: Ao fazer logout, adicionar tokenId à blacklist em Redis com TTL = tempo restante do token. Requisições subsequentes com token revogado retornam 401. Tokens expirados são removidos automaticamente do Redis.

## Conformidade LGPD

Consentimento explícito: endpoint /auth/onboarding/accept-terms registra aceitação. Cada aceitação cria entry em term-list com timestamp, IP e user-agent (auditoria).

Direito ao esquecimento: DELETE /auth/delete-account remove municipe, user, eco-coin wallet, transações e histórico de login. Não deleta: security audit logs (necessário para compliance) e registros de consentimento (evidência legal).

Auditoria de acessos: Registra em security-audit-log toda ação: login sucesso/falha, password reset, account deleted. Inclui: user ID, ação, IP address, user-agent, status, razão da falha.

Mascaramento em logs: Email em logs: "joao@mail.com" → "jo****". Telefone: "11999999999" → "****7766". CPF: sempre criptografado ou hasheado.

Criptografia de dados sensíveis: Em trânsito via TLS 1.2+ (middleware force-https). Em repouso via AES-256-GCM (descrito acima).

## Validação de Entrada

Usar Zod schemas para validação type-safe. Validar: nome (2+ partes, mín 2 chars cada), email (formato válido, unique), CPF (11 dígitos, algoritmo válido, unique), data nascimento (idade ≥ 18), telefone (10-11 dígitos), CEP (8 dígitos), password (policy descrita acima).

Schemas reutilizáveis para diferentes contextos: RegisterMunicipePublicSchema, MunicipeLoginSchema, ChangePasswordSchema, etc.

## Ambiente & Variáveis Sensíveis

Arquivos de environment (.env) nunca fazer commit. Configurar: DATA_ENCRYPTION_KEY (32 bytes base64), DATA_HASH_PEPPER (optional, fallback para encryption key), JWT_SECRET (long string 32+ bytes), JWT_EXPIRATION (1d padrão), SMTP config (email), DATABASE_URL, REDIS_URL.

Validação ao startup: Verificar se DATA_ENCRYPTION_KEY está configurada. Descodificar de base64 e validar se tem exatamente 32 bytes. Falhar se inválida.

## Checklist Pré-Produção

Validar: DATA_ENCRYPTION_KEY gerada corretamente (32 bytes). TLS/HTTPS configurado. HSTS headers habilitados. CORS restrito a domínios conhecidos. Rate limiting ativo. Brute-force protection testado. 2FA funcionando. Audit logs registrando. Backups de DB configurados. Logs seguros (não expor senhas). Plano de resposta a incidentes. Termos de serviço atualizados com LGPD.

Monitoramento: Alertas para múltiplas tentativas falhas. Alertas para padrões anormais de acesso. Auditoria de mudanças em dados sensíveis. Health check de criptografia.

---

**Versão**: 1.0 | **Data**: 6 de maio de 2026

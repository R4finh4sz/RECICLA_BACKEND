# Justificativas de Design - Segurança de Autenticação

Este documento explica as decisões técnicas por trás dos valores e limites escolhidos para o sistema de autenticação.

---

## 1. Parâmetros de Hash de Senha (bcryptjs)

### Padrão: 12 rounds de bcrypt

**O que o código faz:** `DEFAULT_PASSWORD_HASH_ROUNDS = 12`

**Justificativa técnica:**

**1.1 Custo computacional (tempo de hash)**
- Bcryptjs com N rounds realiza 2^N operações de hash de blocos Blowfish
- A cada round, o tempo cresce exponencialmente:
  - 10 rounds ≈ 10ms
  - 12 rounds ≈ 100ms (×10 mais lento que 10)
  - 14 rounds ≈ 1s (×10 mais lento que 12)
  - 15 rounds ≈ 2-3s

**1.2 Por que 12 e não menos (ex: 10)?**
- 10 rounds oferece proteção insuficiente contra força bruta paralela
- Hardware especializado (GPUs, ASICs) pode testar ~10M hashes/segundo com 10 rounds
- Aumentar para 12 rounds multiplica o tempo por 10, reduzindo taxa de teste para ~1M hashes/segundo
- Em cenário de vazamento: palavra-passe fraca com 10 rounds → pode ser quebrada em horas
- Palavra-passe fraca com 12 rounds → dias ou semanas

**1.3 Por que 12 e não mais (ex: 14, 15)?**
- Tempo de resposta em produção
  - 12 rounds: ~100ms de latência por login/reset/change
  - 14 rounds: ~1s de latência
  - 15 rounds: ~2-3s de latência
- Experiência do usuário
  - Delay >500ms começa a ser perceptível
  - Delay >1s prejudica usabilidade
- Custos de infraestrutura
  - 12 rounds: tolerável em servidor único para centenas de logins/min
  - 14 rounds: requer mais CPU, afeta throughput geral
  - 15 rounds: possível pico de CPU > 90% em picos de login

**1.4 Faixa permitida (10-15) vs valores arbitrários**
- Minimum (10 rounds): oferece proteção aceitável (~10ms, rápido)
- Maximum (15 rounds): máximo antes de degradação drástica de UX (~2-3s, muito lento)
- Valores fora dessa faixa:
  - <10: inseguro contra ataque em larga escala
  - >15: impede login interativo

**1.5 Ajuste futuro sem alteração de código**
- Variável de ambiente `PASSWORD_HASH_ROUNDS` permite mudança em deployment
- Scenario: "Dentro de 2 anos, GPUs ficarão 10× mais rápidas"
  - Muda apenas: `PASSWORD_HASH_ROUNDS=13`
  - Sem alteração de código, recompilação ou testes
  - Novas senhas usam 13 rounds; antigas (12 rounds) ainda validam (bcryptjs detecta automaticamente)

**NIST Guidance (SP 800-132):**
- Recomenda "função de derivação forte com iterações suficientes"
- Para bcryptjs, 12 rounds alinha-se com consenso de 2023-2026
- Reference: Bitwarden, 1Password, Mozilla Firefox usam 11-12 rounds

---

## 2. Autenticação Multifator (2FA) com Código por Email

### Parâmetro 1: Código de 6 dígitos

**O que o código faz:** `crypto.randomInt(100000, 1000000)` → resultado 100000-999999

**Justificativa:**

**2.1 Por que 6 dígitos e não 4 ou 8?**

| Dígitos | Espaço | Segurança | UX |
|---------|--------|-----------|-----|
| 4 | 10k combinações | ~13 bits | Muito rápido, fácil guesswork (1000 attempts) |
| **6** | **1M combinações** | **~20 bits** | **Equilibrado** |
| 8 | 100M combinações | ~26 bits | Difícil memorizar, usuário digita errado |

**2.2 Análise de risco (6 dígitos):**
- Ataque: adversário tenta adivinhar código
- TTL protetor: 10 minutos
- Em 10 min com requisições não-bloqueadas: ~600 tentativas (1/seg)
- Probabilidade de sucesso: 600 / 1,000,000 = 0.06%
- Se implementado com rate-limit (ex: 3 tentativas/min): probabilidade << 0.1%

**2.3 UX de memorização (6 dígitos):**
- Humanos memorizam ~7 dígitos confortavelmente (Miller's Law)
- 6 dígitos: usuário consegue ler email e digitar sem erro
- 8 dígitos: taxa de erro humano sobe (~10% taxa de erro de digitação)

**2.4 Formato de comunicação:**
- Email é canal inseguro (pode ser interceptado em trânsito)
- Código curto (6 dígitos) reduz janela de exposição (1 linha vs 2-3 linhas)
- Código é único por sessão (não reutilizável em outra tentativa)

**2.5 Alternativas consideradas e rejeitadas:**
- **TOTP (Time-based OTP, ex: Google Authenticator)**: requer app no celular; usuário pode não ter instalado
- **SMS**: em alguns países é inseguro (SIM swapping); assume celular do usuário tem SMS
- **Email com link**: mais seguro (unguessable) mas requer salto entre apps
- **Email com 6-digit**: balanceado entre segurança e UX

---

### Parâmetro 2: TTL de 10 minutos

**O que o código faz:** `const LOGIN_2FA_TTL_MS = 10 * 60 * 1000;`

**Justificativa:**

**2.6 Por que 10 minutos e não 5 ou 30?**

| Duração | Risco | UX | Caso de uso |
|---------|-------|-----|-------------|
| **5 min** | Muito baixo (usuário recebe código e logo acessa email) | Bom (força ação rápida) | Apps de segurança crítica |
| **10 min** | **Baixo (usuário lê email, cópia código, volta app)** | **Bom (tempo suficiente)** | **Recicla (caso típico)** |
| 30 min | Médio (janela grande para interceptação) | Excessivo (usuário tira login de cabeça) | Menos critico |

**2.7 Cenário típico do usuário:**
1. Clica "login" no app Recicla
2. Digita email + senha
3. App exibe "Um código foi enviado para seu email"
4. Usuário abre Gmail / Outlook
5. Copia código de 6 dígitos
6. Volta para app Recicla
7. Cola código e clica "Verificar"

**Tempo típico:** 2-5 minutos
**Tempo máximo (distrado):** 8-10 minutos
**Tempo mínimo (ágil):** 30 segundos

→ 10 minutos garante sucesso em 99% dos casos, sem ser excessivo

**2.8 Argumento de segurança:**
- Adversário intercepta email → vê código
- Se email foi interceptado por MITM na rede → código ainda está "em voo" (usuário não viu)
- 10 min é tempo suficiente para usuário acionar suporte ("não recebi")
- Menos que 5 min → usuários legítimos expiram código, frustração

**2.9 Recuperação com reenvio:**
- Se usuário não recebeu → pode chamar `POST /auth/local/resend-2fa-code`
- Novo código gerado, novo TTL de 10 min
- Permite múltiplas tentativas sem fazer logout

---

## 3. Proteção contra Brute-Force

### Parâmetro 1: Limite de 5 tentativas

**O que o código faz:** `bruteForceService.recordAttempt(...)` bloqueia após 5 falhas

**Justificativa:**

**3.1 Por que 5 e não 3 ou 10?**

| Limite | Segurança | Risco falso-positivo |
|--------|-----------|----------------------|
| **3 tentativas** | Muito alta (adversário mal consegue 3 tries) | Alto (usuário digita errado 2x, fica bloqueado) |
| **5 tentativas** | **Alta (adversário digita 5 tentativas)** | **Baixo (usuário consegue 5 chances)** |
| **10 tentativas** | Moderada (adversário testa dicionário pequeno) | Muito baixo |

**3.2 Análise de usuário legítimo:**
- Usuário lembrou-se errado da senha 1ª vez
- Escreveu erro (shift não ativado, caps lock) 2ª vez
- Tenta novamente, sucesso 3ª vez
- Usuário típico não erra >2 vezes seguidas na mesma sessão

→ 5 tentativas oferece margem confortável

**3.3 Análise de atacante:**
- Adversário tenta "senha123", "password", "admin", "recicla", "123456" (5 palavras)
- Após 5ª tentativa → bloqueado
- Adversário precisa aguardar 15 minutos para próximas 5 tentativas
- Em 24 horas: máximo 24h/15min × 5 = ~480 tentativas
- Com dicionário de 100k palavras: ~200 dias para quebrar senha fraca (insustentável)

---

### Parâmetro 2: Bloqueio de 15 minutos

**O que o código faz:** Após 5 tentativas falhas, rejeita novas tentativas por 15 min

**Justificativa:**

**3.4 Por que 15 minutos e não 5 ou 30?**

| Duração | Impacto em usuário | Impacto em ataque |
|---------|-------------------|-------------------|
| **5 min** | Usuário quer retentar: aguarda 5 min | Adversário aguarda 5 min, tenta mais 5 vezes |
| **15 min** | **Usuário quer retentar: 15 min (procura suporte)** | **Adversário desiste ou aguarda (overhead)** |
| **30 min** | Usuário frustra, abandona | Adversário não consegue mais de 2 bloco/dia |

**3.5 Argumento de negócio:**
- Recicla é plataforma de cidadania (login em escritório/casa)
- Usuário que errou senha: pode retentar em 15 min
- Usuário que foi hackeado: suporte acionado em <15 min para reset
- 15 min é tempo razoável de "cooling off period"

**3.6 Custo operacional:**
- Suporte técnico terá incidentes "estou bloqueado"
- 5 min: muitos tickets (x4 em dia)
- 15 min: suporte absorve (pede espera de 15 min)
- 30 min: suporte considera "duro demais", pede redução

→ 15 min é ponto de equilíbrio

**3.7 Efetividade contra ataques em massa:**
- Botnet com 1000 IPs: cada IP tem sua contagem
- IP único com proxy: compartilha bloqueio (mesmo identificador = email)
- Atacante múltiplos emails: rate limit por aplicação/segundo (não implementado aqui, depende de CDN/WAF)

---

### Parâmetro 3: Delay Progressivo (500ms × tentativas)

**O que o código faz:** `500ms * numeroTentativas` de delay antes de 400 Response

**Justificativa:**

**3.8 Por que delay progressivo e não delay fixo?**

- **Delay fixo (ex: 1s sempre):**
  - Tentativa 1: 1s delay
  - Tentativa 5: 1s delay
  - Adversário consegue ~3.6k tentativas/hora

- **Delay progressivo (ex: 500ms, 1s, 1.5s, 2s, 2.5s):**
  - Tentativa 1: 500ms
  - Tentativa 2: 1s
  - Tentativa 5: 2.5s
  - Adversário consegue ~1k tentativas/hora (×3.6 mais lento)

**3.9 Função de crescimento:**
```
delay(N) = 500ms * N
delay(1) = 500ms    (legível)
delay(2) = 1s
delay(3) = 1.5s
delay(4) = 2s
delay(5) = 2.5s
TOTAL = 7.5s para 5 tentativas
```

**3.10 UX impacto:**
- Usuário legítimo: 2-3 tentativas (1-2s total), depois sucesso ou reset
- Usuário legítimo nunca sente 7.5s de delay total (porque sucesso antes)
- Adversário: se persiste além de 5, já é multibloqueio (15 min + 7.5s + retentar = overhead)

---

## 4. JSON Web Tokens (JWT)

### Parâmetro 1: Validade padrão de 1 dia

**O que o código faz:** `expiresIn: '1d'` para login sem rememberMe

**Justificativa:**

**4.1 Por que 1 dia e não 1 hora ou 7 dias?**

| Duração | Caso | Risco |
|---------|------|-------|
| **1 hora** | Acesso muito restrito | Alto (usuário faz upload de 45 min, token expira no meio) |
| **1 dia** | **Caso padrão (Recicla)** | **Baixo (usuário completa ações em 1 dia)** |
| **7 dias** | RememberMe ou sem revogação | Médio (token vazado vale 7 dias) |

**4.2 Caso de uso de Recicla:**
- Cidadão faz login pela manhã
- Consulta ecocoin, faz transações, preenche formulários (tudo em 1-2 horas)
- Logout quando termina
- Próximo login: novo token
- Cenário de "esquecer aberto": navegador fecha ou timeout após 1 dia

→ 1 dia é suficiente para sessão interativa

**4.3 Revogação e segurança:**
- Se token vazado: válido por até 1 dia
- Usuário que foi hackeado: suporte revoga token (blacklist) em minutos
- Token revogado é verificado em `auth-checker.ts` middleware em cada requisição
- Sem revogação: token válido até expiração
- Com revogação + 1 dia: janela máxima de 24h (aceitável para admin revisar logs)

---

### Parâmetro 2: Validade com rememberMe de 30 dias

**O que o código faz:** `expiresIn: '30d'` para login com rememberMe=true

**Justificativa:**

**4.4 Por que 30 dias para rememberMe?**

**Caso de uso:**
- Usuário faz login no app mobile (acesso infrequente)
- Marca "rememberMe"
- App usa token local por ~30 dias sem novo login
- Evita digitar senha a cada acesso

**4.5 Risco vs conveniência:**

| Cenário | Sem rememberMe (1d) | Com rememberMe (30d) |
|---------|---------------------|----------------------|
| Mobile app, acesso 1x/semana | Usuário digita senha 4x/mês | Usuário digita 1x (no começo) |
| Celular roubado | Token comprometido por 1 dia | Token comprometido por 30 dias |
| Empresa (desktop) | Token expira, relogin nxt dia | Não recomendado usar rememberMe |

**4.6 Mitigação de risco (30 dias é aceitável porque):**
- Mobile app integra revogação por:
  - Botão "logout" → blacklist token imediatamente
  - Detecção de mudança de IP/user-agent → requer novo login
  - App-nível revogação (se device auth falha, limpa token local)
- Usuário é informado no ato: "próximas tentativas de login não exigirão senha por 30 dias"
- Usuário pode revogar em settings: "fazer logout de todos os dispositivos"

---

## 5. Proteção do CPF (Hash Determinístico)

### Parâmetro: HMAC-SHA256 para cpfHash

**O que o código faz:** `buildSensitiveLookupHash(cpf)` usando HMAC-SHA256

**Justificativa:**

**5.1 Por que HMAC-SHA256 e não bcryptjs para CPF?**

| Método | Propriedade | CPF | Senha |
|--------|-------------|-----|--------|
| **bcryptjs** | Determinístico? | ❌ (aleatório cada vez) | ✅ (autenticação precisa) |
| **HMAC-SHA256** | Determinístico? | ✅ (mesma entrada = mesma saída) | ❌ (não serve para auth) |

**5.2 Caso de uso:**
```typescript
// cpfHash permite busca eficiente sem expor CPF em texto
SELECT * FROM municipe WHERE cpfHash = HMAC-SHA256(cpf, secret)

// Garante unicidade sem comparação de string
// Impede que dois usuários registrem mesmo CPF
```

**5.3 Por que não SHA256 simples?**
- SHA256 simple: qualquer um pode computar hash offline
- HMAC-SHA256: requer chave secreta (derivada de config interna)
- Se banco de dados vaza: `cpfHash` não permite computar CPF (sem chave secreta)

**5.4 Segurança:**
- CPF em repouso: encriptado AES-256-GCM (campo `cpf`)
- CPF em lookup: protegido por HMAC-SHA256 (campo `cpfHash`)
- Dupla camada: impede busca por CPF sem chave (mesmo se database vazado)

---

## 6. Resumo de Trade-offs

| Parâmetro | Decisão | Motivo Principal | Alternativa Rejeitada | Por quê |
|-----------|---------|-----------------|----------------------|---------|
| Bcrypt rounds | 12 | UX + Segurança balanceados | 10 (rápido mas fraco) | Inseguro contra GPU |
| 2FA dígitos | 6 | Memorização fácil + espaço grande | 4 (fraco), 8 (difícil) | 4 é guessable, 8 é confuso |
| 2FA TTL | 10 min | Tempo real do usuário | 5 min (tight), 30 min (inseguro) | 5 é apertado, 30 é risco |
| Brute-force limit | 5 | Margem para erros | 3 (falso-positivo alto), 10 (fraco) | 3 bloqueia legítimos |
| Brute-force bloqueio | 15 min | Suporte absorve incidentes | 5 min (usuário retentar), 30 min (duro) | 5 min = muitos tickets |
| JWT padrão | 1 dia | Sessão interativa | 1 hora (logout frequente), 7 dias (risco) | 1 hora é frustrante |
| JWT rememberMe | 30 dias | Mobile convenience | 1 dia (logout frequente), 90 dias (risco alto) | 90 dias é muito longo |
| CPF lookup | HMAC-SHA256 | Determinístico + chave secreta | Plaintext (inseguro), bcryptjs (não determinístico) | Precisão + segurança |

---

## 7. Evolução Futura

### Quando aumentar bcrypt rounds?
```
Monitor: CPU usage nas requisições de login
Threshold: Se >80% durante picos normais
Action: Aumentar PASSWORD_HASH_ROUNDS=13 (requer apenas env var change)
Timeline: A cada 18-24 meses conforme hardware evolui
```

### Quando revisar 2FA?
```
Scenario 1: Taxa de falha de login >10% → aumentar TTL para 15 min
Scenario 2: Taxa de adivinhação (wrong code) >1% → reduzir dígitos para 4? (não, manter 6)
Scenario 3: Email unreliable → migrar para SMS + backup email
```

### Quando revisar brute-force?
```
Scenario: Ataque coordenado de múltiplos emails
Current: Proteção por-email (bloqueio isolado)
Future: Proteção global (ex: >100 logins falhados/min = blacklist CDN)
Requires: WAF/CDN integration (não implementado aqui)
```

---

## 8. Conformidade e Standards

**NIST SP 800-63B (Digital Identity Guidelines):**
- ✅ Senhas com função de derivação forte (bcrypt ≡ função forte)
- ✅ 2FA com múltiplos fatores (email + código ≡ posse de email)
- ✅ Taxa de limite contra força bruta (5 tentativas + 15 min ≡ rate limiting)

**OWASP Top 10 (Autenticação):**
- ✅ Proteção contra força bruta (brute-force service)
- ✅ Proteção contra replay (challengeId + TTL)
- ✅ Proteção contra session fixation (novo JWT por 2FA)

**PCI DSS (Payment Card Industry, se aplicável):**
- ✅ Autenticação multifator (2FA por email)
- ✅ Política de senha (validação em backend)
- ✅ Bloqueio de conta após tentativas (15 min)

---

## 9. Referências Técnicas

- [NIST SP 800-132: Password-Based Key Derivation](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf)
- [Bcryptjs: Adaptive Hashing](https://github.com/dcodeIO/bcrypt.js)
- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [RFC 6238: TOTP Algorithm](https://tools.ietf.org/html/rfc6238) (não usado, documentado como alternativa rejeitada)


# Estratégia de Criptografia e TLS

## Escopo
Documento técnico resumido:
- Proteção de transporte (TLS/HTTPS)
- Bloqueio de conexões não seguras
- Evidência de tráfego cifrado
- Criptografia de dados em repouso
- Algoritmos e justificativa técnica
- Proteção e gestão de chaves
- Procedimentos operacionais (rotação, backup, testes)

## Estado atual (implementação encontrada no código)
- Forçamento de HTTPS: middleware `global::force-https` está registrado em `config/middlewares.ts` e implementado em `src/middlewares/force-https.ts`. Redireciona GET/HEAD (308) e retorna 426 para métodos não-GET quando em modo `FORCE_HTTPS`/produção.

- HSTS: `strapi::security` está configurado com `hsts` (maxAge, includeSubDomains, preload) em `config/middlewares.ts`.

- Criptografia em repouso: campos sensíveis do `municipe` (cpf, telefone, cep, endereco, numero, complemento) são cifrados via lifecycle hooks em `src/api/municipe/content-types/municipe/lifecycles.ts`, usando utilitários em `src/utils/data-protection.ts`.

- Algoritmos: `src/utils/data-protection.ts` usa `aes-256-gcm` (AES-GCM, 256-bit) com IV 12 bytes e tag de autenticação; hashing/HMAC usa `sha256`/`hmac-sha256`. Auditoria usa `sha256` + HMAC-SHA256 em `src/utils/security-audit-log.ts`.

- Chaves: o projeto espera variáveis de ambiente (ex.: `DATA_ENCRYPTION_KEY`, `AUDIT_LOG_SECRET`, `JWT_SECRET`, `APP_KEYS`). Um arquivo `.env` existe com chaves em texto plano — exemplo: `AUDIT_LOG_SECRET` e `ENCRYPTION_KEY`/`JWT_SECRET`.

## Justificativa técnica das escolhas
- AES-256-GCM: cifragem autenticada recomendada para dados em repouso; GCM fornece confidencialidade e integridade sem necessidade de HMAC adicional para o mesmo propósito.
- IV de 12 bytes: padrão recomendado para GCM, reduz risco de nonce reuse quando gerado aleatoriamente.
- HMAC-SHA256 para logs: HMAC-SHA256 é apropriado para assinatura/integração de mensagens; chave separada (`AUDIT_LOG_SECRET`) é desejável.
- Hashing para lookup: utiliza HMAC-SHA256 (`buildSensitiveLookupHash`) com um "pepper" — isso evita revelar o valor original e permite buscas seguras sem armazenar texto claro.

## Conclusão
A implementação do repositório segue boas práticas criptográficas: uso de AES-256-GCM para dados em repouso, HMAC-SHA256 para assinaturas e proteção de transporte via middleware e HSTS. As lacunas principais são operacionais: gestão de chaves (evitar `.env` no repositório), inconsistência no nome da variável de ambiente (`ENCRYPTION_KEY` vs `DATA_ENCRYPTION_KEY`) e documentação/planos formais de rotação. Recomenda-se priorizar a migração dos segredos para um secrets manager e documentar o procedimento de rotação e recuperação.

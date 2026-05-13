# Estratégia de Criptografia e TLS (Implementação Atual)

## Escopo

- Proteção de transporte (HTTPS/TLS)
- Cabeçalhos de segurança (HSTS)
- Criptografia de dados sensíveis em repouso
- Integridade de trilha de auditoria

## Implementação confirmada no código

### Transporte seguro
- Middleware global `global::force-https` habilitado no pipeline.
- `strapi::security` com HSTS habilitado (`maxAge`, `includeSubDomains`, `preload`).

### Dados em repouso
- Lifecycle do munícipe aplica tratamento criptográfico em campos sensíveis.
- Utilitários de proteção de dados usam AES-256-GCM.
- CPF possui hash determinístico separado para busca segura (`cpfHash`).

### Integridade de auditoria
- Trilha de segurança com hash encadeado e assinatura HMAC.
- Imutabilidade lógica por lifecycle para impedir update/delete no audit log.

## Variáveis e segredos (uso no projeto)

- O código depende de variáveis sensíveis para criptografia, JWT e auditoria.
- A gestão operacional desses segredos (rotação, vault, políticas de acesso) é responsabilidade de ambiente/deploy.

## Conclusão técnica

A base implementa os controles criptográficos centrais no nível de aplicação:
- proteção de transporte (HTTPS + HSTS),
- proteção de dados sensíveis em repouso,
- e integridade de logs de segurança.

As lacunas remanescentes são operacionais, não de lógica principal da aplicação.
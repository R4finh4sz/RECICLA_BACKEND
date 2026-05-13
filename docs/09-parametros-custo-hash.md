# Parâmetros de custo do hash de senha

Este documento descreve apenas o que está implementado no código atual em `src/utils/password-hash.ts`.

## O que o código faz

- O hash de senha é feito com `bcryptjs`.
- O número de rounds padrão é `12`.
- O valor pode ser sobrescrito pela variável de ambiente `PASSWORD_HASH_ROUNDS`.
- O valor aceito por configuração fica entre `10` e `15`.
- Se a variável de ambiente estiver ausente, o sistema usa o padrão `12`.
- Se a variável não for um inteiro, o código lança erro.
- Se o valor estiver fora da faixa `10..15`, o código lança erro.

## Regras exatas observadas no código

Arquivo de origem: `src/utils/password-hash.ts`

```ts
const DEFAULT_PASSWORD_HASH_ROUNDS = 12;
const MIN_PASSWORD_HASH_ROUNDS = 10;
const MAX_PASSWORD_HASH_ROUNDS = 15;
```

```ts
export function getPasswordHashRounds() {
  const raw = String(process.env.PASSWORD_HASH_ROUNDS || '').trim();
  if (!raw) return DEFAULT_PASSWORD_HASH_ROUNDS;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error('PASSWORD_HASH_ROUNDS invalido. Use um inteiro entre 10 e 15.');
  }

  if (parsed < MIN_PASSWORD_HASH_ROUNDS || parsed > MAX_PASSWORD_HASH_ROUNDS) {
    throw new Error('PASSWORD_HASH_ROUNDS fora da faixa segura (10..15).');
  }

  return parsed;
}
```

## Como isso é usado

- A função `hashPassword()` chama `getPasswordHashRounds()` e passa o valor retornado para `bcrypt.hash(...)`.
- Portanto, o custo efetivo do hash é sempre o valor padrão `12` ou o valor configurado em `PASSWORD_HASH_ROUNDS`, desde que esteja dentro da faixa permitida.

## Justificativa que dá para afirmar a partir do código

O código não traz uma explicação narrativa formal do motivo dos valores escolhidos.
O que ele deixa explícito é:

- existe um padrão de `12` rounds;
- a faixa permitida foi limitada a `10..15`;
- a própria mensagem de erro chama essa faixa de `segura`;
- a validação impede configurações fora dessa faixa.

Em termos práticos, a implementação mostra que o projeto quer permitir ajuste de custo sem aceitar valores arbitrários.

## Exemplo de configuração

```env
PASSWORD_HASH_ROUNDS=12
```

Esse valor faz o sistema usar exatamente o padrão do código.

export function pickAllowedMasterUpdate(body: any) {
  const allowedKeys = ['complemento', 'endereco', 'cep', 'cidade', 'telefone'] as const;
  const out: Record<string, any> = {};
  for (const k of allowedKeys) if (body?.[k] !== undefined) out[k] = body[k];
  return out;
}
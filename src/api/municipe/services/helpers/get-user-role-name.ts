// Service do módulo Municipe: implementa regras de negócio para gestão do perfil e dados do Municipe.

export function getUserRoleName(ctx: any) {
  const role = ctx?.state?.user?.role;

  if (!role) return null;

  // role pode ser string
  if (typeof role === 'string') return role;

  // role pode ser objeto com name
  if (typeof role === 'object' && role?.name) return role.name;

  // role pode ser id numérico
  if (typeof role === 'number') return String(role);

  // role pode ser objeto com id
  if (typeof role === 'object' && role?.id != null) return String(role.id);

  return null;
}
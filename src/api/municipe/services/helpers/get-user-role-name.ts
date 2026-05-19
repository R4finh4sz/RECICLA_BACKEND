// Resolvedor de role do usuário autenticado, com fallback ao banco quando o JWT
// não traz a role populada com nome.

export async function getUserRoleName(ctx: any, strapi?: any) {
  const user = ctx?.state?.user;
  const role = user?.role;

  if (!role) {
    return null;
  }

  if (typeof role === 'string') {
    return role;
  }

  if (typeof role === 'object' && role?.name) {
    return role.name;
  }

  if (strapi && user?.id != null) {
    const dbUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id as any },
      populate: ['role'],
    });

    const dbRoleName = (dbUser as any)?.role?.name;
    if (dbRoleName) {
      return dbRoleName;
    }

    const dbRoleType = (dbUser as any)?.role?.type;
    if (dbRoleType) {
      return dbRoleType;
    }
  }

  if (typeof role === 'number') {
    return String(role);
  }

  if (typeof role === 'object' && role?.id != null) {
    return String(role.id);
  }

  return null;
}
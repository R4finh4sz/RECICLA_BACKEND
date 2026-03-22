export default async (policyContext: any, _config: any, { strapi }: any) => {
  const ctx = policyContext;

  const user = ctx?.state?.user;
  if (!user) return false;

  const roleName = user?.role?.name || user?.role;
  const allowed = roleName === 'Admin' || roleName === 'Master';

  if (!allowed) {
    strapi.log.warn(`[admin-guard] blocked user=${user?.id} role=${roleName}`);
  }

  return allowed;
};
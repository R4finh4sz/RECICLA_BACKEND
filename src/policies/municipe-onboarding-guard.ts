export default async (policyContext: any, _config: any, { strapi }: any) => {
  const ctx = policyContext;

  const user = ctx.state.user;
  if (!user) return false;

  const roleName = user?.role?.name || user?.role;
  if (roleName !== 'Municipe') return false;

  // Rotas liberadas durante onboarding
  const method = (ctx.request.method || '').toUpperCase();
  const path = ctx.request.path || '';

  const allowlist = new Set([
    'GET /auth/onboarding/status',
    'PATCH /auth/onboarding/accept-terms',
    'POST /auth/first-access',
    'GET /municipes/me',
    'PUT /municipes/me',
  ]);

  if (allowlist.has(`${method} ${path}`)) {
    return true;
  }

  // Busca first-access-control do usuário
  const fac = await strapi
    .documents('api::first-access-control.first-access-control')
    .findFirst({
      filters: { user: { id: user.id as any } },
    });

  // Se não existir FAC, bloqueia
  if (!fac) return false;

  const mustCompleteProfile = Boolean((fac as any).mustCompleteProfile);
  const mustAcceptTerms = Boolean((fac as any).mustAcceptTerms);
  const mustChangePassword = Boolean((fac as any).mustChangePassword);

  // Se onboarding pendente, bloqueia tudo fora da allowlist
  if (mustCompleteProfile || mustAcceptTerms || mustChangePassword) {
    return false;
  }

  return true;
};
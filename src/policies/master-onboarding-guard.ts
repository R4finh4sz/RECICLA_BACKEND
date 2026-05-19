export default async (policyContext: any, _config: any, { strapi }: any) => {
  const ctx = policyContext;

  const user = ctx.state.user;
  if (!user) return false;

  const roleName = user?.role?.name || user?.role;
  if (roleName !== 'Master') return false;

  const method = (ctx.request.method || '').toUpperCase();
  const path = ctx.request.path || '';

  // Allowlist com suporte a parâmetros (ex: :id) e prefixo /api
  const allowlist = [
    'GET /master/onboarding/status',
    'PATCH /master/onboarding/accept-terms',
    'PATCH /master/onboarding/revoke-terms',
    'PUT /master/edit-profile/:id',
  ];

  const requestKey = `${method} ${path}`;

  const matchesAllowed = (allowedEntry: string, reqKey: string) => {
    // transforma '/master/edit-profile/:id' em regex '/master/edit-profile/[^/]+'
    const [allowedMethod, allowedPath] = allowedEntry.split(' ');
    if (!allowedMethod || !allowedPath) return false;
    if (allowedMethod !== method) return false;

    const escaped = allowedPath.replace(/:[^/]+/g, '[^/]+');
    const patterns = [`^${escaped}$`, `^/api${escaped}$`];
    return patterns.some((p) => new RegExp(p).test(path));
  };

  for (const a of allowlist) {
    if (matchesAllowed(a, requestKey)) return true;
  }

  const fac = await strapi
    .documents('api::first-access-control.first-access-control')
    .findFirst({
      filters: { user: { id: user.id as any } },
    });

  if (!fac) return false;

  const mustCompleteProfile = Boolean((fac as any).mustCompleteProfile);
  const mustAcceptTerms = Boolean((fac as any).mustAcceptTerms);
  const mustChangePassword = Boolean((fac as any).mustChangePassword);

  if (mustCompleteProfile || mustAcceptTerms || mustChangePassword) {
    return false;
  }

  return true;
};
import { getUserRoleName } from '../api/municipe/services/helpers/get-user-role-name';

export default async (policyContext: any, _config: any, { strapi }: any) => {
  const ctx = policyContext;

  const user = ctx.state.user;
  if (!user) return false;

  const roleName = await getUserRoleName(ctx, strapi);
  if (roleName !== 'Municipe') return false;

  // Rotas liberadas durante onboarding
  const method = (ctx.request.method || '').toUpperCase();
  const path = String(ctx.request.path || '').replace(/^\/api\b/, '');

  // Allowlist com suporte a parâmetros (ex: :id) e prefixo /api
  const allowlist = [
    'GET /auth/onboarding/status',
    'PATCH /auth/onboarding/accept-terms',
    'PATCH /auth/onboarding/revoke-terms',
    'POST /auth/first-access',
    'GET /municipes/me',
    'PUT /municipes/me',
  ];

  const requestKey = `${method} ${path}`;

  const matchesAllowed = (allowedEntry: string, reqKey: string) => {
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
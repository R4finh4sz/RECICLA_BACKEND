export default async (policyContext: any) => {
  const user = policyContext?.state?.user;
  if (!user) return false;

  const roleName = user?.role?.name || user?.role;
  return roleName === 'Master';
};
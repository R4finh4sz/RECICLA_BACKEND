export function deriveSaltFromUser(user: any): string {
  if (!user) return '';
  // tenta campos comuns em pt/en para sobrenome
  const last =
    (user.sobrenome || user.lastName || user.lastname || '')
      .toString()
      .trim();

  if (last) {
    const cleaned = last.replace(/\s+/g, '');
    return cleaned.slice(0, 3).toLowerCase();
  }

  // fallback: tentar extrair do name/firstName (último token)
  const name =
    (user.name || user.nome || user.firstName || user.firstname || '')
      .toString()
      .trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[parts.length - 1].replace(/\s+/g, '');
      if (candidate) return candidate.slice(0, 3).toLowerCase();
    }
  }

  // fallback final: username/email prefix
  if (user.username) return user.username.toString().slice(0, 3).toLowerCase();
  if (user.email) return user.email.toString().split('@')[0].slice(0, 3).toLowerCase();

  return '';
}
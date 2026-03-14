// Service do módulo Municipe: implementa regras de negócio para gestão do perfil e dados do Municipe.

export function isStrongPassword(pwd: string) {
  if (typeof pwd !== 'string') return false;
  if (pwd.length < 8) return false;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-=\[\]\/;\\']/g.test(pwd);
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

export const strongPasswordMessage =
  'Senha deve ter no mínimo 8 caracteres, com 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial.';
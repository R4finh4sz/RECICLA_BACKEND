// Validações do módulo Municipe: schemas para garantir integridade dos dados de entrada.
// Depende de: Zod (validação de dados).

import { z } from 'zod';
import { isStrongPassword, strongPasswordMessage } from '../services/helpers/password-policy';

export const ResetPasswordSchema = z
  .object({
    email: z.string().email(),
    code: z.string().min(4).max(12),
    newPassword: z.string().min(8).refine(isStrongPassword, { message: strongPasswordMessage }),
    confirmPassword: z.string().min(8)
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
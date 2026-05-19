// Validações do módulo Master: schemas para garantir integridade dos dados de entrada.
// Depende de: Zod (validação de dados).

import { z } from 'zod';

export const MasterLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});
export type MasterLoginInput = z.infer<typeof MasterLoginSchema>;
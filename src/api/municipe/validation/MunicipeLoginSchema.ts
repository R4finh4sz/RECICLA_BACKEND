// Validações do módulo Municipe: schemas para garantir integridade dos dados de entrada.
// Depende de: Zod (validação de dados).

import { z } from 'zod';

export const MunicipeLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});
export type MunicipeLoginInput = z.infer<typeof MunicipeLoginSchema>;
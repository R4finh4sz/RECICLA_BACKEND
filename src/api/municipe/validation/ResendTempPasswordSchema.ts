// Validações do módulo Municipe: schemas para garantir integridade dos dados de entrada.
// Depende de: Zod (validação de dados).

import { z } from 'zod';

export const ResendTempPasswordSchema = z.object({
  email: z.string().email(),
});

export type ResendTempPasswordInput = z.infer<typeof ResendTempPasswordSchema>;
// Validações do módulo Municipe: schemas para garantir integridade dos dados de entrada.
// Depende de: Zod (validação de dados).

import { z } from 'zod';

export const RequestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>;
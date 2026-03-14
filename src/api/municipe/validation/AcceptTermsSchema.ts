// Validações do módulo Municipe: schemas para garantir integridade dos dados de entrada.
// Depende de: Zod (validação de dados).

import { z } from 'zod';

export const AcceptTermsSchema = z.object({
  version: z.string().min(1),
  contentHash: z.string().min(1),
});

export type AcceptTermsInput = z.infer<typeof AcceptTermsSchema>;
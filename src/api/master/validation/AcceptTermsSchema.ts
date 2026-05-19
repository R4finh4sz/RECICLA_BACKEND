// Validações do módulo Master: schemas para garantir integridade dos dados de entrada.
// Depende de: Zod (validação de dados).

import { z } from "zod";

// Permite body vazio — caso nenhum campo seja enviado, o serviço usa o termo ativo.
export const AcceptTermsSchema = z
  .object({
    version: z.string(),
    documentId: z.string(),
  })
  .partial();

export type AcceptTermsInput = z.infer<typeof AcceptTermsSchema>;

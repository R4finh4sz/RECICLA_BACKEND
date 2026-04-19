import { z } from 'zod';

export const DeleteAccountSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual e obrigatoria.'),
});

export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;

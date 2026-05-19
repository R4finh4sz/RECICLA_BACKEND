import { z } from 'zod';

export const ConfirmEmailCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Código deve conter 6 dígitos'),
});

export type ConfirmEmailCodeInput = z.infer<typeof ConfirmEmailCodeSchema>;

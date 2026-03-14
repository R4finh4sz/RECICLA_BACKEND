import { z } from 'zod';

export const ResendEmailConfirmationCodeSchema = z.object({
  email: z.string().email(),
});

export type ResendEmailConfirmationCodeInput = z.infer<typeof ResendEmailConfirmationCodeSchema>;

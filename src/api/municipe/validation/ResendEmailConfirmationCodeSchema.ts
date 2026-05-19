import { z } from 'zod';

export const ResendEmailConfirmationCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export type ResendEmailConfirmationCodeInput = z.infer<typeof ResendEmailConfirmationCodeSchema>;

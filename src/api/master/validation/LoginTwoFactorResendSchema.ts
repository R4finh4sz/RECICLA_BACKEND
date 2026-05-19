import { z } from 'zod';

export const LoginTwoFactorResendSchema = z.object({
  email: z.string().email(),
  challengeId: z.string().min(1),
});

export type LoginTwoFactorResendInput = z.infer<typeof LoginTwoFactorResendSchema>;

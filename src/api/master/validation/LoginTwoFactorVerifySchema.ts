import { z } from 'zod';

export const LoginTwoFactorVerifySchema = z.object({
  email: z.string().email(),
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Codigo deve conter 6 digitos'),
});

export type LoginTwoFactorVerifyInput = z.infer<typeof LoginTwoFactorVerifySchema>;

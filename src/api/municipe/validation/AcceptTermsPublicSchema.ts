import { z } from "zod";

export const AcceptTermsPublicSchema = z.object({
  version: z.string().min(1),
  documentId: z.string().min(1),
});

export type AcceptTermsPublicInput = z.infer<typeof AcceptTermsPublicSchema>;

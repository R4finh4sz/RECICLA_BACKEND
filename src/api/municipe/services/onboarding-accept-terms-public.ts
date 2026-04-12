import { ZodError } from "zod";
import {
  AcceptTermsPublicSchema,
  type AcceptTermsPublicInput,
} from "../validation/AcceptTermsPublicSchema";

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let payload: AcceptTermsPublicInput;

    try {
      payload = AcceptTermsPublicSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) {
        return ctx.badRequest("Body inválido. Envie { version, documentId }.");
      }
      throw err;
    }

    const termo = await strapi.service("api::termo.get-active-termo").execute();
    if (!termo)
      return ctx.badRequest("Nenhum termo ativo disponível para aceite.");

    if (
      payload.version !== (termo as any).version ||
      payload.documentId !==
        String((termo as any).documentId || (termo as any).id)
    ) {
      return ctx.badRequest("Termo desatualizado. Atualize e tente novamente.");
    }

    return {
      accepted: true,
      message: "Termo válido para aceite no cadastro.",
      termo: {
        version: (termo as any).version,
        documentId: String((termo as any).documentId || (termo as any).id),
      },
    };
  },
});

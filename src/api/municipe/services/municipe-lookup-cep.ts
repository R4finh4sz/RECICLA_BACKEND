import { lookupCepViaCep } from './helpers/cep';

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const cep = String(ctx.params?.cep || '').trim();
    if (!cep) return ctx.badRequest('CEP inválido.');

    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return ctx.badRequest('CEP inválido.');

    try {
      const result = await lookupCepViaCep(strapi, clean);

      if (!result) return ctx.notFound('CEP não encontrado.');

      return result;
    } catch (err: any) {
      strapi.log.warn(`[lookup-cep] erro ao validar CEP: ${String(err?.message || err)}`);
      return ctx.badRequest('Não foi possível consultar o CEP no momento. Tente novamente.');
    }
  },
});
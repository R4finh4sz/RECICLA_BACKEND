import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::eco-coin-transaction.eco-coin-transaction",
  ({ strapi }) => ({
    async me(ctx) {
      const result = await strapi
        .service("api::eco-coin-transaction.me")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Histórico carregado." };
    },
  }),
);
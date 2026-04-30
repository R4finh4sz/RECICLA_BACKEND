import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::eco-coin.eco-coin",
  ({ strapi }) => ({
    async me(ctx) {
      const result = await strapi.service("api::eco-coin.me").execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Saldo carregado." };
    },

    async redeem(ctx) {
      const result = await strapi
        .service("api::eco-coin.redeem")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Troca realizada com sucesso!" };
    },
  }),
);
export default ({ strapi }) => ({
  async execute(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) ctx.unauthorized();

    const wallet = await strapi.db.query("api::eco-coin.eco-coin").findOne({
      where: { user: userId },
    });

    if (!wallet) return { balance: 0 };

    return { id: wallet.id, balance: wallet.balance };
  },
});
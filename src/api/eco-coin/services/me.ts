export default ({ strapi }) => ({
  async execute(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) ctx.unauthorized();

    const walletQuery = strapi.db.query("api::eco-coin.eco-coin");

    let wallet = await walletQuery.findOne({
      where: { user: userId },
    });

    if (!wallet) {
      wallet = await walletQuery.create({
        data: { user: userId, balance: 0 },
      });
    }

    return { id: wallet.id, balance: wallet.balance };
  },
});
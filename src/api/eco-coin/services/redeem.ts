export default ({ strapi }) => ({
  async execute(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) ctx.unauthorized();

    const { tradeItemId } = ctx.request.body || {};
    if (!tradeItemId) ctx.badRequest("tradeItemId is required");

    const tradeItem = await strapi.db.query("api::trade-item.trade-item").findOne(
      {
        where: { id: tradeItemId, active: true },
      },
    );

    if (!tradeItem) ctx.notFound("Trade item not found");

    const wallet = await strapi.db.query("api::eco-coin.eco-coin").findOne({
      where: { user: userId },
    });

    if (!wallet) ctx.notFound("Eco Coin not found for this user");

    const price = tradeItem.value;

    if (wallet.balance < price) ctx.badRequest("Insufficient balance");

    const newBalance = wallet.balance - price;

    await strapi.db.query("api::eco-coin.eco-coin").update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    const transaction = await strapi.db
      .query("api::eco-coin-transaction.eco-coin-transaction")
      .create({
        data: {
          amount: price,
          description: `Troca: ${tradeItem.name}`,
          user: userId,
          trade_item: tradeItem.id,
        },
      });

    return {
      balance: newBalance,
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    };
  },
});
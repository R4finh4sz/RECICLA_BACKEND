export default ({ strapi }) => ({
  async execute(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) ctx.unauthorized();

    const rows = await strapi.db
      .query("api::eco-coin-transaction.eco-coin-transaction")
      .findMany({
        where: { user: userId },
        orderBy: { createdAt: "desc" },
        populate: {
          trade_item: { select: ["name", "value"] },
        },
      });

    return rows.map((t) => ({
      id: t.id,
      amount: t.amount,
      description: t.description,
      createdAt: t.createdAt,
      tradeItem: t.trade_item
        ? {
            id: t.trade_item.id,
            name: t.trade_item.name,
            value: t.trade_item.value,
          }
        : null,
    }));
  },
});
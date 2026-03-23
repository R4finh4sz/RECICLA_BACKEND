export default ({ strapi }: { strapi: any }) => ({
  async execute() {
    return strapi.documents('api::termo.termo').findFirst({
      filters: { active: { $eq: true } },
      sort: { updatedAt: 'desc' },
    });
  }
});
export default ({ strapi }: { strapi: any }) => ({
  async execute() {
    return strapi.documents('api::termo.termo').findFirst({
      sort: { updatedAt: 'desc' },
    });
  }
});
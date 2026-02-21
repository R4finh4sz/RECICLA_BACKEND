/**
 * termo controller
 */
import { factories } from '@strapi/strapi';
import { CreateTermo } from '../services/CreateTermo';
import { ListTermo } from '../services/ListTermo';
import { GetActiveTermo } from '../services/GetActiveTermo';
import { UpdateTermo } from '../services/UpdateTermo';

// Exporta o handler principal do módulo termo.
export default factories.createCoreController('api::termo.termo', () => ({
  // GET /api/termos
  async find(ctx) {
    return new ListTermo().execute(ctx);
  },

  // GET /api/termos/:id (opcional manter core)
  async findOne(ctx) {
    // se quiser core padrão, remova esse método
    return await strapi.documents('api::termo.termo').findOne({
      documentId: ctx.params.id,
    });
  },

  // POST /api/termos
  async create(ctx) {
    return new CreateTermo().execute(ctx);
  },

  // PUT /api/termos/:id
  async update(ctx) {
    return new UpdateTermo().execute(ctx);
  },

  // GET /api/termos/active  (rota custom)
  async getActive(ctx) {
    return new GetActiveTermo().execute(ctx);
  },
}));
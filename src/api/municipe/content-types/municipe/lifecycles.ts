// Schema do módulo Municipe: definição de estrutura e relações de dados.

export default {
  async beforeCreate(event: any) {
    const data = event.params.data || {};
    delete data.__createdByMasterFlow;
    event.params.data = data;
  },
};
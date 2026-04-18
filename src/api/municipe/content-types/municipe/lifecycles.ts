function onlyDigits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function normalizeFullName(nome: unknown) {
  return String(nome ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export default {
  async beforeCreate(event: any) {
    const data = event.params.data || {};

    delete data.__createdByMasterFlow;
    if (data._newUserId && !data.user) {
      data.user = data._newUserId;
    }
    delete data._newUserId;

    if (data.nome != null) data.nome = normalizeFullName(data.nome);
    if (data.cpf != null) data.cpf = onlyDigits(data.cpf);
    if (data.cep != null) data.cep = onlyDigits(data.cep);
    if (data.telefone != null) data.telefone = onlyDigits(data.telefone);

    event.params.data = data;
  },

  async beforeUpdate(event: any) {
    const data = event.params.data || {};

    delete data.__createdByMasterFlow;

    if (data.nome != null) data.nome = normalizeFullName(data.nome);
    if (data.cpf != null) data.cpf = onlyDigits(data.cpf);
    if (data.cep != null) data.cep = onlyDigits(data.cep);
    if (data.telefone != null) data.telefone = onlyDigits(data.telefone);

    event.params.data = data;
  },
};

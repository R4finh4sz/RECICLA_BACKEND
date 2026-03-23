// Lifecycles do Municipe.
// Eu uso este arquivo para padronizar os dados antes de salvar no banco.
// A ideia é evitar CPF/CEP/telefone com pontuação diferente e também não deixar campo interno ir para o BD.

function onlyDigits(v: unknown) {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizeFullName(nome: unknown) {
  return String(nome ?? '').trim().replace(/\s+/g, ' ');
}

export default {
  async beforeCreate(event: any) {
    const data = event.params.data || {};

    // Campo interno que eu uso no fluxo de cadastro; não é para persistir no banco.
    delete data.__createdByMasterFlow;

    // Normalizações básicas
    if (data.nome != null) data.nome = normalizeFullName(data.nome);
    if (data.cpf != null) data.cpf = onlyDigits(data.cpf);
    if (data.cep != null) data.cep = onlyDigits(data.cep);
    if (data.telefone != null) data.telefone = onlyDigits(data.telefone);

    event.params.data = data;
  },

  async beforeUpdate(event: any) {
    const data = event.params.data || {};

    delete data.__createdByMasterFlow;

    // Normalizações defensivas no update.
    if (data.nome != null) data.nome = normalizeFullName(data.nome);
    if (data.cpf != null) data.cpf = onlyDigits(data.cpf);
    if (data.cep != null) data.cep = onlyDigits(data.cep);
    if (data.telefone != null) data.telefone = onlyDigits(data.telefone);

    event.params.data = data;
  },
};
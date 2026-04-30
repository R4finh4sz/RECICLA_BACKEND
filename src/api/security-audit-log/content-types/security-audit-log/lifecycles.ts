const IMMUTABLE_ERROR_MESSAGE =
  'Security audit logs sao imutaveis. Atualizacao e exclusao nao sao permitidas.';

function throwImmutableError() {
  throw new Error(IMMUTABLE_ERROR_MESSAGE);
}

export default {
  async beforeUpdate() {
    throwImmutableError();
  },

  async beforeDelete() {
    throwImmutableError();
  },

  async beforeUpdateMany() {
    throwImmutableError();
  },

  async beforeDeleteMany() {
    throwImmutableError();
  },
};

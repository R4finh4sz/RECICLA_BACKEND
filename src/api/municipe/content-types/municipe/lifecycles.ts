import {
  buildSensitiveLookupHash,
  decryptIfNeeded,
  encryptIfNeeded,
} from '../../../../utils/data-protection';

function onlyDigits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function normalizeFullName(nome: unknown) {
  return String(nome ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

const ENCRYPTED_FIELDS = [
  'cpf',
  'telefone',
  'cep',
  'endereco',
  'numero',
  'complemento',
] as const;

function protectWriteData(data: Record<string, unknown>) {
  if (data.cpf != null) {
    const normalizedCpf = onlyDigits(data.cpf);
    data.cpf = normalizedCpf;
    data.cpfHash = buildSensitiveLookupHash(normalizedCpf);
  }

  for (const field of ENCRYPTED_FIELDS) {
    if (data[field] != null) {
      data[field] = encryptIfNeeded(data[field]);
    }
  }
}

function unprotectReadData(entry: Record<string, unknown> | null | undefined) {
  if (!entry) return;

  for (const field of ENCRYPTED_FIELDS) {
    if (entry[field] != null) {
      entry[field] = decryptIfNeeded(entry[field]);
    }
  }
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

    protectWriteData(data);

    event.params.data = data;
  },

  async beforeUpdate(event: any) {
    const data = event.params.data || {};

    delete data.__createdByMasterFlow;

    if (data.nome != null) data.nome = normalizeFullName(data.nome);
    if (data.cpf != null) data.cpf = onlyDigits(data.cpf);
    if (data.cep != null) data.cep = onlyDigits(data.cep);
    if (data.telefone != null) data.telefone = onlyDigits(data.telefone);

    protectWriteData(data);

    event.params.data = data;
  },

  async afterCreate(event: any) {
    unprotectReadData(event?.result);
  },

  async afterUpdate(event: any) {
    unprotectReadData(event?.result);
  },

  async afterFindOne(event: any) {
    unprotectReadData(event?.result);
  },

  async afterFindMany(event: any) {
    const result = event?.result;
    if (!Array.isArray(result)) return;

    for (const entry of result) {
      unprotectReadData(entry);
    }
  },
};

import {
  buildSensitiveLookupHash,
  decryptIfNeeded,
  encryptIfNeeded,
} from '../../../../utils/data-protection';

function onlyDigits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
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

  if (data.telefone != null) {
    const normalizedTelefone = onlyDigits(data.telefone);
    data.telefone = normalizedTelefone;
    data.telefoneHash = buildSensitiveLookupHash(normalizedTelefone);
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
    if (data.cidade != null) data.cidade = normalizeFullName(data.cidade);
    if (data.estado != null) data.estado = normalizeFullName(data.estado);
    if (data.endereco != null) data.endereco = normalizeFullName(data.endereco);
    if (data.numero != null) data.numero = String(data.numero).trim();
    if (data.complemento != null) data.complemento = String(data.complemento).trim();

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
    if (data.cidade != null) data.cidade = normalizeFullName(data.cidade);
    if (data.estado != null) data.estado = normalizeFullName(data.estado);
    if (data.endereco != null) data.endereco = normalizeFullName(data.endereco);
    if (data.numero != null) data.numero = String(data.numero).trim();
    if (data.complemento != null) data.complemento = String(data.complemento).trim();

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

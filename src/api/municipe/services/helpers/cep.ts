// Helper de CEP (RN 3.4.5)
// Eu coloquei aqui dentro do módulo Municipe para manter o padrão do projeto e não criar uma API nova só pra isso.
// Esse helper consulta o ViaCEP e devolve { endereco, cidade, estado } quando o CEP existe.

type CepLookupResult = {
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
};

function normalizeCep(cep: unknown) {
  return String(cep ?? '').replace(/\D/g, '');
}

function normalizeText(v: unknown) {
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

export async function lookupCepViaCep(strapi: any, cepInput: unknown): Promise<CepLookupResult | null> {
  const cep = normalizeCep(cepInput);

  // valida formato básico (8 dígitos)
  if (cep.length !== 8) return null;

  const url = `https://viacep.com.br/ws/${cep}/json/`;

  let res: Response;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch (err) {
    strapi.log.warn(`[cep] falha ao chamar ViaCEP: ${String(err)}`);
    throw new Error('CEP_SERVICE_UNAVAILABLE');
  }

  if (!res.ok) {
    strapi.log.warn(`[cep] ViaCEP respondeu HTTP ${res.status} para CEP=${cep}`);
    throw new Error('CEP_SERVICE_UNAVAILABLE');
  }

  const data: any = await res.json();

  // ViaCEP retorna { erro: true } quando não encontra
  if (data?.erro === true) return null;

  const logradouro = normalizeText(data?.logradouro);
  const bairro = normalizeText(data?.bairro);
  const localidade = normalizeText(data?.localidade);
  const uf = normalizeText(data?.uf);

  // endereço “montado” só pra ficar mais útil
  const endereco = [logradouro, bairro].filter(Boolean).join(' - ');

  if (!localidade || !uf) return null;

  return {
    cep,
    endereco,
    cidade: localidade,
    estado: uf,
  };
}
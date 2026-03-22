import { z } from 'zod';
import { isStrongPassword, strongPasswordMessage } from '../services/helpers/password-policy';

function isValidCPF(cpf: string) {
  const cleanCPF = cpf.replace(/\D/g, '');

  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  const firstDigitSum = [...Array(9).keys()].reduce(
    (sum, i) => sum + parseInt(cleanCPF.charAt(i), 10) * (10 - i),
    0
  );

  const firstCheck = firstDigitSum % 11 < 2 ? 0 : 11 - (firstDigitSum % 11);

  const secondDigitSum = [...Array(10).keys()].reduce(
    (sum, i) => sum + parseInt(cleanCPF.charAt(i), 10) * (11 - i),
    0
  );

  const secondCheck = secondDigitSum % 11 < 2 ? 0 : 11 - (secondDigitSum % 11);

  return (
    parseInt(cleanCPF.charAt(9), 10) === firstCheck &&
    parseInt(cleanCPF.charAt(10), 10) === secondCheck
  );
}

function normalizeFullName(nome: string) {
  return String(nome || '').trim().replace(/\s+/g, ' ');
}

function isValidFullName(nome: string) {
  const value = normalizeFullName(nome);
  if (value.length < 3) return false;

  const parts = value.split(' ').filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.some((p) => p.length < 2)) return false;

  const regex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
  return regex.test(value);
}

function calcAge(birthDate: Date, now = new Date()) {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

export const RegisterMunicipePublicSchema = z
  .object({
    nome: z
      .string()
      .min(3, 'Nome deve ter no mínimo 3 caracteres')
      .transform(normalizeFullName)
      .refine(isValidFullName, {
        message: 'Nome completo inválido. Use apenas letras e espaços.',
      }),
    email: z.string().email('E-mail inválido'),
    username: z.string().min(3).optional(),
    password: z.string().min(8).refine(isStrongPassword, { message: strongPasswordMessage }),
    confirmPassword: z.string().min(8),
    cpf: z.string().refine(isValidCPF, { message: 'CPF inválido' }),
    dataNascimento: z.coerce.date(),
    endereco: z.string().min(1),
    complemento: z.string().optional(),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
    cidade: z.string().min(1),
    estado: z.string().min(1),
    telefone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  })
  .refine((d) => calcAge(d.dataNascimento) >= 18, {
    message: 'Cadastro permitido apenas para maiores de 18 anos.',
    path: ['dataNascimento'],
  });

export type RegisterMunicipePublicInput = z.infer<typeof RegisterMunicipePublicSchema>;
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

export const RegisterMunicipePublicSchema = z
  .object({
    nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    email: z.string().email('E-mail inválido'),
    username: z.string().min(3).optional(),
    password: z.string().min(8).refine(isStrongPassword, { message: strongPasswordMessage }),
    confirmPassword: z.string().min(8),
    cpf: z.string().refine(isValidCPF, { message: 'CPF inválido' }),
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
  });

export type RegisterMunicipePublicInput = z.infer<typeof RegisterMunicipePublicSchema>;

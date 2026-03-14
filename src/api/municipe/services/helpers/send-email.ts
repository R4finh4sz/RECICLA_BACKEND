// Service do módulo Municipe: implementa regras de negócio para gestão do perfil e dados do Municipe.

import type { Core } from '@strapi/strapi';

function extractEmailAddress(value: string) {
  const match = value.match(/<\s*([^>\s]+)\s*>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  return value.trim().toLowerCase();
}

function resolveFromAddress(
  strapi: Core.Strapi,
  host: string,
  user: string,
  from: string | undefined
) {
  const normalizedHost = host.trim().toLowerCase();
  const normalizedUser = user.trim().toLowerCase();

  if (!from || !from.trim()) {
    return normalizedUser;
  }

  const fromEmail = extractEmailAddress(from);
  const isGmailSmtp = normalizedHost === 'smtp.gmail.com' || normalizedHost.endsWith('.gmail.com');

  if (isGmailSmtp && fromEmail !== normalizedUser) {
    strapi.log.warn('[email] SMTP_FROM diferente de SMTP_USER no Gmail; usando SMTP_USER como remetente para evitar rejeição DMARC.');
    return normalizedUser;
  }

  return from;
}

export async function sendEmail(
  strapi: Core.Strapi,
  params: { to: string; subject: string; text: string }
) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  // Executa rotina de gestão do perfil e dados do Municipe.
  if (!host || !port || !user || !pass) {
    strapi.log.warn('[email] SMTP env vars not configured; skipping email send.');
    return;
  }

  const finalFrom = resolveFromAddress(strapi, host, user, from);

  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: finalFrom,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
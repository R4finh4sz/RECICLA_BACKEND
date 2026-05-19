import type { Core } from '@strapi/strapi';

export async function sendEmail(
  strapi: Core.Strapi,
  params: { to: string; subject: string; text: string }
) {
  await strapi.plugin('email').service('email').send({
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
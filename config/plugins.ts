import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const port = env.int('SMTP_PORT', 587);

  return {
    email: {
      config: {
        provider: 'nodemailer',
        providerOptions: {
          host: env('SMTP_HOST', 'smtp.gmail.com'),
          port,
          secure: port === 465,        // SSL
          requireTLS: port === 587,    // STARTTLS
          auth: {
            user: env('SMTP_USER'),
            pass: env('SMTP_PASS'),
          },
        },
        settings: {
          defaultFrom: env('SMTP_FROM', env('SMTP_USER')),
          defaultReplyTo: env('SMTP_REPLY_TO', env('SMTP_FROM', env('SMTP_USER'))),
        },
      },
    },
  };
};

export default config;
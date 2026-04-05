import type { Core } from "@strapi/strapi";

const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Core.Config.Database => {
  const client = env(
    "DATABASE_CLIENT",
    "postgres",
  ) as Core.Config.Database["connection"]["client"];

  return {
    connection: {
      client,
      connection: {
        connectionString: env("DATABASE_URL"),
        host: env("DATABASE_HOST", "localhost"),
        port: env.int("DATABASE_PORT", 5432),
        database: env("DATABASE_NAME", "strapi"),
        user: env("DATABASE_USERNAME", "strapi"),
        password: env("DATABASE_PASSWORD", "strapi"),
        schema: env("DATABASE_SCHEMA", "public"),
        ssl: env.bool("DATABASE_SSL", false)
          ? {
              rejectUnauthorized: env.bool(
                "DATABASE_SSL_REJECT_UNAUTHORIZED",
                false,
              ),
            }
          : false,
      },
      pool: {
        min: env.int("DATABASE_POOL_MIN", 2),
        max: env.int("DATABASE_POOL_MAX", 10),
      },
      acquireConnectionTimeout: env.int("DATABASE_CONNECTION_TIMEOUT", 60000),
    },
  };
};

export default config;

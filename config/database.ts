import type { Core } from "@strapi/strapi";

const stripSslQueryParams = (databaseUrl: string) => {
  const url = new URL(databaseUrl);

  url.searchParams.delete("ssl");
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");
  url.searchParams.delete("sslpassword");

  return url.toString();
};

const hasSslQueryParam = (databaseUrl: string) => {
  const sslMode = new URL(databaseUrl).searchParams.get("sslmode");

  return sslMode != null && sslMode.toLowerCase() !== "disable";
};

const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Core.Config.Database => {
  const client = env(
    "DATABASE_CLIENT",
    "postgres",
  ) as Core.Config.Database["connection"]["client"];
  const databaseUrl = env("DATABASE_URL");
  const sslEnabled =
    env.bool("DATABASE_SSL", false) ||
    (databaseUrl ? hasSslQueryParam(databaseUrl) : false);
  const ssl = sslEnabled
    ? {
        rejectUnauthorized: env.bool("DATABASE_SSL_REJECT_UNAUTHORIZED", false),
      }
    : false;

  return {
    connection: {
      client,
      connection: {
        host: env("DATABASE_HOST", "localhost"),
        port: env.int("DATABASE_PORT", 5432),
        database: env("DATABASE_NAME", "strapi"),
        user: env("DATABASE_USERNAME", "strapi"),
        password: env("DATABASE_PASSWORD", "strapi"),
        schema: env("DATABASE_SCHEMA", "public"),
        ...(databaseUrl
          ? {
              connectionString: stripSslQueryParams(databaseUrl),
            }
          : {}),
        ssl,
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

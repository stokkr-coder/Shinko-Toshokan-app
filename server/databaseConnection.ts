export type MySqlConnectionConfig = {
  url: string;
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  ssl?: { rejectUnauthorized: boolean };
};

export function getMySqlConnectionConfig(databaseUrl: string): MySqlConnectionConfig {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get("ssl-mode")?.toUpperCase();
  url.searchParams.delete("ssl-mode");
  const port = url.port ? Number(url.port) : undefined;
  const ssl = !sslMode || sslMode === "DISABLED" ? undefined : {
    // REQUIRED no Aiven exige criptografia, mas não valida a CA; preservamos essa semântica no mysql2.
    rejectUnauthorized: sslMode === "VERIFY_CA" || sslMode === "VERIFY_IDENTITY",
  };

  return {
    url: url.toString(),
    host: url.hostname,
    ...(port ? { port } : {}),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ...(ssl ? { ssl } : {}),
  };
}

import { defineConfig } from "drizzle-kit";
import { getMySqlConnectionConfig } from "./server/databaseConnection";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}
const connection = getMySqlConnectionConfig(databaseUrl);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: connection.host,
    ...(connection.port ? { port: connection.port } : {}),
    user: connection.user,
    password: connection.password,
    database: connection.database,
    ...(connection.ssl ? { ssl: connection.ssl } : {}),
  },
});

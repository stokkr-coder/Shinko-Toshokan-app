import { describe, expect, it } from "vitest";
import { getMySqlConnectionConfig } from "./databaseConnection";

describe("configuração de conexão MySQL", () => {
  it("converte ssl-mode=REQUIRED em SSL explícito compatível com mysql2", () => {
    const config = getMySqlConnectionConfig("mysql://avnadmin:senha@host.aivencloud.com:23111/biblioteca_shinko?ssl-mode=REQUIRED");

    expect(config.url).not.toContain("ssl-mode");
    expect(config.url).toContain("biblioteca_shinko");
    expect(config).toMatchObject({ host: "host.aivencloud.com", port: 23111, user: "avnadmin", database: "biblioteca_shinko", ssl: { rejectUnauthorized: false } });
  });

  it("preserva conexões sem a opção SSL específica do Aiven", () => {
    const config = getMySqlConnectionConfig("mysql://usuario:senha@localhost:3306/biblioteca");

    expect(config).toMatchObject({ url: "mysql://usuario:senha@localhost:3306/biblioteca", host: "localhost", port: 3306, user: "usuario", password: "senha", database: "biblioteca" });
    expect(config.ssl).toBeUndefined();
  });
});

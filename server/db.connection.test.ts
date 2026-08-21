import { describe, expect, it } from "vitest";
import { getDatabaseConnectionConfig } from "./db";

describe("configuração de conexão MySQL", () => {
  it("converte ssl-mode=REQUIRED em SSL explícito compatível com mysql2", () => {
    const config = getDatabaseConnectionConfig("mysql://avnadmin:senha@host.aivencloud.com:23111/biblioteca_shinko?ssl-mode=REQUIRED");

    expect(config.url).not.toContain("ssl-mode");
    expect(config.url).toContain("biblioteca_shinko");
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("preserva conexões sem a opção SSL específica do Aiven", () => {
    const config = getDatabaseConnectionConfig("mysql://usuario:senha@localhost:3306/biblioteca");

    expect(config).toEqual({ url: "mysql://usuario:senha@localhost:3306/biblioteca", ssl: undefined });
  });
});

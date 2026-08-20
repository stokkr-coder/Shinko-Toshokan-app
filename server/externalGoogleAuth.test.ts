import { describe, expect, it } from "vitest";
import { isAllowedExternalEmail, roleForExternalGoogleUser } from "./externalGoogleAuth";

describe("autorização externa via Google", () => {
  it("autoriza apenas o administrador e os e-mails explicitamente liberados", () => {
    expect(isAllowedExternalEmail("oscar@example.com", "oscar@example.com", "leitor@example.com")).toBe(true);
    expect(isAllowedExternalEmail("leitor@example.com", "oscar@example.com", "leitor@example.com")).toBe(true);
    expect(isAllowedExternalEmail("outro@example.com", "oscar@example.com", "leitor@example.com")).toBe(false);
  });

  it("mantém o proprietário como administrador e cria convidados como leitores", () => {
    expect(roleForExternalGoogleUser("oscar@example.com", "oscar@example.com")).toBe("admin");
    expect(roleForExternalGoogleUser("leitor@example.com", "oscar@example.com")).toBe("user");
    expect(roleForExternalGoogleUser("leitor@example.com", "oscar@example.com", "admin")).toBe("admin");
  });
});

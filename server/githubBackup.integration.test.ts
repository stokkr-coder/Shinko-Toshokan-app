import { describe, expect, it } from "vitest";
import { GITHUB_BACKUP_REPOSITORY_PATH, verifyGitHubBackupRepository } from "./githubBackup";

const describeWithGitHubToken = process.env.GITHUB_BACKUP_TOKEN ? describe : describe.skip;

describeWithGitHubToken("credencial de backup GitHub", () => {
  it("acessa o repositório privado configurado com o token fornecido", async () => {
    const repository = await verifyGitHubBackupRepository();
    expect(repository.repository).toBe(GITHUB_BACKUP_REPOSITORY_PATH);
    expect(repository.branch).toBeTruthy();
  });
});

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  importMutate: vi.fn(),
  restoreGitHubMutate: vi.fn(),
  remoteBook: {
    uid: "remote-1", raw: "Livro remoto - Autor", title: "Livro remoto", author: "AUTOR, Remoto", media: "0L", genre: "60", slug: "REMO", volume: "00", collection: "", seriesCode: "", seriesNumber: "", extension: "epub", shinkoId: "ST.0L.60.REMO-00", filename: "remoto.epub", classification: "Literatura Geral", confidence: "Alta" as const, warningsJson: "[]", duplicate: 0,
  },
}));

const localBook = {
  uid: "local-2", raw: "Livro local - Autor", title: "Livro local", author: "AUTOR, Local", media: "0L", genre: "60", slug: "LOCA", volume: "00", collection: "", seriesCode: "", seriesNumber: "", extension: "epub", shinkoId: "ST.0L.60.LOCA-00", filename: "local.epub", classification: "Literatura Geral", confidence: "Alta" as const, warnings: [], duplicate: false,
};

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Shinko" }, loading: false, isAuthenticated: true, logout: vi.fn() }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const invalidate = vi.fn();
  const emptyList: never[] = [];
  const githubVersions = [{ path: "backups/2026-08-18/catalogo.json", size: 340 }];
  const snapshot = { books: [testState.remoteBook], rules: emptyList, assets: emptyList, metadata: emptyList, readingEvents: emptyList, goals: emptyList, wantToRead: emptyList };
  const monitor = { settings: { uid: "monitor-test", alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "weekly" as const, reportEnabled: true, scheduleCronTaskUid: "", lastReportAt: null }, totalBooks: 1, generalCount: 0, reviewCount: 0, generalPercentBasisPoints: 0, exceeded: false, summary: { topAuthors: [], topTerms: [], topCollections: [], generalBookUids: [] }, latestReport: null };
  const utils = { library: { snapshot: { invalidate }, rules: { invalidate }, assets: { invalidate }, metadata: { invalidate }, reading: { invalidate }, readingGoals: { invalidate }, wantToRead: { invalidate }, classificationMonitor: { dashboard: { invalidate }, history: { invalidate } }, backups: { invalidate }, githubBackups: { settings: { invalidate } } } };
  const idleMutation = { mutate: vi.fn(), isPending: false };
  return {
    trpc: {
      useUtils: () => utils,
      library: {
        snapshot: { useQuery: () => ({ data: snapshot }) },
        rules: { list: { useQuery: () => ({ data: emptyList }) }, save: { useMutation: () => idleMutation }, remove: { useMutation: () => idleMutation } },
        assets: { list: { useQuery: () => ({ data: emptyList }) }, save: { useMutation: () => idleMutation }, upload: { useMutation: () => idleMutation }, remove: { useMutation: () => idleMutation } },
        metadata: { list: { useQuery: () => ({ data: emptyList }) }, lookupIsbn: { useMutation: () => idleMutation }, save: { useMutation: () => idleMutation } },
        reading: { list: { useQuery: () => ({ data: emptyList }) }, add: { useMutation: () => idleMutation } },
        readingGoals: { list: { useQuery: () => ({ data: emptyList }) }, save: { useMutation: () => idleMutation } },
        wantToRead: { list: { useQuery: () => ({ data: emptyList }) }, save: { useMutation: () => idleMutation }, remove: { useMutation: () => idleMutation }, reorder: { useMutation: () => idleMutation }, beginReading: { useMutation: () => idleMutation } }, classificationMonitor: { dashboard: { useQuery: () => ({ data: monitor }) }, history: { useQuery: () => ({ data: emptyList }) }, saveSettings: { useMutation: () => idleMutation }, runNow: { useMutation: () => idleMutation }, schedule: { useMutation: () => idleMutation } },
        githubBackups: { settings: { useQuery: () => ({ data: { uid: "github-test", repository: "stokkr-coder/Shinko-Toshokan", enabled: false, scheduleCronTaskUid: "", lastBackupAt: null, lastBackupPath: "", lastCommitSha: "", lastError: "" } }) }, listVersions: { useQuery: () => ({ data: githubVersions, isLoading: false }) }, runNow: { useMutation: () => idleMutation }, schedule: { useMutation: () => idleMutation }, restoreVersion: { useMutation: () => ({ mutate: testState.restoreGitHubMutate, isPending: false }) } }, backups: { list: { useQuery: () => ({ data: emptyList }) }, create: { useMutation: () => idleMutation }, restore: { useMutation: () => idleMutation }, importSnapshot: { useMutation: () => idleMutation } },
        importBooks: { useMutation: () => ({ mutate: testState.importMutate }) }, saveBook: { useMutation: () => idleMutation }, removeBook: { useMutation: () => idleMutation },
      },
    },
  };
});

import Home from "./Home";

describe("sincronização pela interface", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("biblioteca-shinko-records-v1", JSON.stringify([localBook]));
    vi.stubGlobal("confirm", vi.fn(() => true));
    testState.importMutate.mockClear();
    testState.restoreGitHubMutate.mockClear();
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("arquiva o cache local ao usar a cópia remota e o recupera por meio dos controles da página", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByRole("heading", { name: "Escolha como unir seus registros." });
    await user.click(screen.getByRole("button", { name: /Usar a cópia da conta/ }));

    expect(JSON.parse(localStorage.getItem("biblioteca-shinko-local-archive-v1") || "[]")).toEqual([localBook]);
    await user.click(screen.getByRole("button", { name: "Adicionar 1 registros arquivados" }));

    await waitFor(() => expect(localStorage.getItem("biblioteca-shinko-local-archive-v1")).toBeNull());
    expect(testState.importMutate).toHaveBeenCalledWith(expect.objectContaining({ books: [localBook] }), expect.any(Object));
  });

  it("lista uma versão datada e exige confirmação antes de solicitar a restauração", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByRole("heading", { name: "Escolha como unir seus registros." });
    await user.click(screen.getByRole("button", { name: /Usar a cópia da conta/ }));
    await user.click(screen.getByRole("button", { name: /Backup/ }));
    expect(await screen.findByText("2026-08-18")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Restaurar esta versão" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Restaurar esta versão do GitHub"));
    expect(testState.restoreGitHubMutate).toHaveBeenCalledWith({ path: "backups/2026-08-18/catalogo.json" }, expect.any(Object));
  });
});

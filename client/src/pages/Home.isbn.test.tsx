import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({ saveMetadata: vi.fn(), saveGoal: vi.fn(), saveWantToRead: vi.fn(), reorderWantToRead: vi.fn(), beginReading: vi.fn(), writeWorkbook: vi.fn(), importBooks: vi.fn(), toastError: vi.fn(), hideRemoteBooks: false, assets: [] as Array<{ uid: string; bookUid: string; kind: "physical" | "digital-link" | "digital-file"; label: string; location: string; sourceUrl: string; storageKey: string; storageUrl: string; mimeType: string; byteSize: number }>, readingEvents: [] as Array<{ uid: string; bookUid: string; type: "started" | "progress" | "finished" | "abandoned" | "note"; page: number; progress: number; note: string; occurredAt: number }>, wantToRead: [] as Array<{ uid: string; bookUid: string; priority: "Alta" | "Média" | "Baixa"; note: string; position: number }>, monitor: { settings: { uid: "monitor-test", alertThresholdCount: 1, alertThresholdPercent: 5, reportFrequency: "weekly" as const, reportEnabled: true, scheduleCronTaskUid: "", lastReportAt: null }, totalBooks: 2, generalCount: 1, reviewCount: 1, generalPercentBasisPoints: 5000, exceeded: true, summary: { topAuthors: [{ label: "AUTOR, Sem regra", count: 1 }], topTerms: [{ label: "incomum", count: 1 }], topCollections: [{ label: "Sem coleção", count: 1 }], generalBookUids: ["book-isbn"] }, latestReport: null }, remoteBook: { uid: "book-isbn", raw: "Zen speaks", title: "Zen speaks", author: "CAI, Zhizhong", media: "0L", genre: "60", slug: "CAIZ", volume: "00", collection: "", seriesCode: "", seriesNumber: "", extension: "epub", shinkoId: "ST.0L.60.CAIZ-00", filename: "zen-speaks.epub", classification: "Literatura", confidence: "Alta" as const, warningsJson: "[]", duplicate: 0 }, secondBook: { uid: "book-second", raw: "Duna", title: "Duna", author: "HERBERT, Frank", media: "0L", genre: "41", slug: "HERB", volume: "01", collection: "Duna", seriesCode: "DUNA", seriesNumber: "Livro 01", extension: "epub", shinkoId: "ST.0L.41.HERB-01", filename: "duna.epub", classification: "Ficção Científica", confidence: "Média" as const, warningsJson: "[]", duplicate: 0 } }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Shinko" }, loading: false, isAuthenticated: true, logout: vi.fn() }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: testState.toastError, message: vi.fn() } }));
vi.mock("xlsx", async () => ({ ...(await vi.importActual<object>("xlsx")), writeFile: (...args: unknown[]) => testState.writeWorkbook(...args) }));
vi.mock("@/lib/trpc", () => {
  const invalidate = vi.fn(); const emptyList: never[] = []; const idle = { mutate: vi.fn(), isPending: false };
  const isbnResult = { isbn: "9780385472579", title: "Zen speaks", subtitle: "Shouts of nothingness", authors: ["Zhizhong Cai"], publisher: "Anchor Books", publishedDate: "1994", pageCount: 159, summary: "Assuntos: Zen Buddhism.", coverUrl: "/manus-storage/cover.jpg", coverStorageKey: "library/cover.jpg", source: "Open Library", sourceUrl: "https://openlibrary.org/isbn/9780385472579" };
  const monitor = testState.monitor;
  return { trpc: { useUtils: () => ({ library: { snapshot: { invalidate }, rules: { invalidate }, assets: { invalidate }, metadata: { invalidate }, reading: { invalidate }, readingGoals: { invalidate }, wantToRead: { invalidate }, classificationMonitor: { dashboard: { invalidate }, history: { invalidate } }, backups: { invalidate }, githubBackups: { settings: { invalidate } } } }), library: {
    snapshot: { useQuery: () => ({ data: { books: testState.hideRemoteBooks ? emptyList : [testState.remoteBook, testState.secondBook], rules: emptyList, assets: emptyList, metadata: emptyList, readingEvents: testState.readingEvents, goals: emptyList, wantToRead: testState.wantToRead } }) },
    rules: { list: { useQuery: () => ({ data: emptyList }) }, save: { useMutation: () => idle }, remove: { useMutation: () => idle } }, assets: { list: { useQuery: () => ({ data: testState.assets }) }, save: { useMutation: () => idle }, upload: { useMutation: () => idle }, remove: { useMutation: () => idle } },
    metadata: { list: { useQuery: () => ({ data: emptyList }) }, lookupIsbn: { useMutation: () => ({ isPending: false, mutate: (_input: unknown, options: { onSuccess: (value: typeof isbnResult) => void }) => options.onSuccess(isbnResult) }) }, save: { useMutation: () => ({ isPending: false, mutate: (input: unknown, options: { onSuccess: () => void }) => { testState.saveMetadata(input); options.onSuccess(); } }) } },
    reading: { list: { useQuery: () => ({ data: testState.readingEvents }) }, add: { useMutation: () => idle } }, readingGoals: { list: { useQuery: () => ({ data: emptyList }) }, save: { useMutation: () => ({ isPending: false, mutate: (input: unknown, options: { onSuccess: () => void }) => { testState.saveGoal(input); options.onSuccess(); } }) } }, wantToRead: { list: { useQuery: () => ({ data: testState.wantToRead }) }, save: { useMutation: () => ({ isPending: false, mutate: (input: unknown, options: { onSuccess: () => void }) => { testState.saveWantToRead(input); options.onSuccess(); } }) }, remove: { useMutation: () => idle }, reorder: { useMutation: () => ({ isPending: false, mutate: (input: unknown, options: { onSuccess: () => void }) => { testState.reorderWantToRead(input); options.onSuccess(); } }) }, beginReading: { useMutation: () => ({ isPending: false, mutate: (input: unknown, options: { onSuccess: () => void }) => { testState.beginReading(input); options.onSuccess(); } }) } }, classificationMonitor: { dashboard: { useQuery: () => ({ data: monitor }) }, history: { useQuery: () => ({ data: emptyList }) }, saveSettings: { useMutation: () => idle }, runNow: { useMutation: () => idle }, schedule: { useMutation: () => idle } }, githubBackups: { settings: { useQuery: () => ({ data: { uid: "github-test", repository: "stokkr-coder/Shinko-Toshokan", enabled: false, scheduleCronTaskUid: "", lastBackupAt: null, lastBackupPath: "", lastCommitSha: "", lastError: "" } }) }, listVersions: { useQuery: () => ({ data: emptyList, isLoading: false }) }, runNow: { useMutation: () => idle }, schedule: { useMutation: () => idle }, restoreVersion: { useMutation: () => idle } }, backups: { list: { useQuery: () => ({ data: emptyList }) }, create: { useMutation: () => idle }, restore: { useMutation: () => idle }, importSnapshot: { useMutation: () => idle } }, importBooks: { useMutation: () => ({ isPending: false, mutate: (input: unknown, options: { onSuccess: (value: unknown) => void }) => { testState.importBooks(input); options.onSuccess({ count: 1, report: { generalCount: 1, exceeded: true } }); } }) }, saveBook: { useMutation: () => idle }, removeBook: { useMutation: () => idle },
  } } };
});

import Home from "./Home";

describe("revisão de metadados ISBN na ficha", () => {
  beforeEach(() => { localStorage.clear(); testState.saveMetadata.mockClear(); testState.saveGoal.mockClear(); testState.saveWantToRead.mockClear(); testState.reorderWantToRead.mockClear(); testState.beginReading.mockClear(); testState.writeWorkbook.mockClear(); testState.importBooks.mockClear(); testState.toastError.mockClear(); testState.hideRemoteBooks = false; testState.assets = []; testState.readingEvents = []; testState.wantToRead = []; });
  afterEach(() => cleanup());
  it("exibe e confirma editora, data, páginas e resumo retornados pelo ISBN", async () => {
    const user = userEvent.setup(); render(<Home />);
    await user.click(await screen.findByRole("button", { name: /Editar Zen speaks/ }));
    await user.type(screen.getByPlaceholderText("ISBN-10 ou ISBN-13"), "9780385472579");
    await user.click(screen.getByRole("button", { name: "Preencher ISBN" }));
    expect(await screen.findByText("Revise antes de salvar")).toBeTruthy();
    expect(screen.getByDisplayValue("Anchor Books")).toBeTruthy();
    expect(screen.getByDisplayValue("1994")).toBeTruthy();
    expect(screen.getByDisplayValue("159")).toBeTruthy();
    expect(screen.getByDisplayValue("Assuntos: Zen Buddhism.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Salvar metadados ISBN" }));
    await waitFor(() => expect(testState.saveMetadata).toHaveBeenCalledWith(expect.objectContaining({ publisher: "Anchor Books", publishedDate: "1994", pageCount: 159, summary: "Assuntos: Zen Buddhism." })));
  });

  it("combina confiança, disponibilidade de exemplar e ordenação na busca avançada", async () => {
    testState.assets = [{ uid: "asset-duna", bookUid: "book-second", kind: "digital-file", label: "Duna EPUB", location: "", sourceUrl: "", storageKey: "", storageUrl: "", mimeType: "application/epub+zip", byteSize: 123 }];
    const user = userEvent.setup();
    render(<Home />);
    await waitFor(() => expect(document.querySelectorAll(".records-table tbody strong")).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: /Busca avançada/ }));

    await user.selectOptions(screen.getByLabelText("Confiança da classificação"), "Média");
    await waitFor(() => expect(Array.from(document.querySelectorAll(".records-table tbody strong")).map((item) => item.textContent)).toEqual(["Duna"]));
    expect(screen.queryByText("Zen speaks")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Confiança da classificação"), "all");
    await user.selectOptions(screen.getByLabelText("Exemplares vinculados"), "linked");
    await waitFor(() => expect(Array.from(document.querySelectorAll(".records-table tbody strong")).map((item) => item.textContent)).toEqual(["Duna"]));
    expect(screen.queryByText("Zen speaks")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Exemplares vinculados"), "all");
    await user.selectOptions(screen.getByLabelText("Ordenar resultados"), "author");
    await waitFor(() => expect(Array.from(document.querySelectorAll(".records-table tbody strong")).map((item) => item.textContent)).toEqual(["Zen speaks", "Duna"]));
  });

  it("salva metas e prepara o Excel do diário de leitura", async () => {
    const user = userEvent.setup(); render(<Home />);
    await user.click(await screen.findByRole("button", { name: /Leitura/ }));
    expect(await screen.findByText("Metas que acompanham seu diário.")).toBeTruthy();
    const goalInputs = screen.getAllByLabelText("Meta de livros");
    await user.clear(goalInputs[0]); await user.type(goalInputs[0], "4");
    await user.click(screen.getAllByRole("button", { name: "Salvar meta" })[0]);
    await waitFor(() => expect(testState.saveGoal).toHaveBeenCalledWith(expect.objectContaining({ period: "monthly", targetBooks: 4 })));
    await user.click(screen.getByRole("button", { name: "Exportar diário Excel" }));
    expect(testState.writeWorkbook).toHaveBeenCalledWith(expect.objectContaining({ SheetNames: ["Resumo de metas", "Diário de leitura", "Obras concluídas"] }), expect.stringMatching(/^diario-leitura-shinko-\d{4}\.xlsx$/));
  });

  it("exibe a anotação e a data/hora da atualização recente na estante", async () => {
    testState.readingEvents = [{ uid: "reading-1", bookUid: "book-isbn", type: "progress", page: 73, progress: 46, note: "Retomar capítulo 5", occurredAt: 1_725_000_000_000 }];
    render(<Home />);
    expect(await screen.findByText("Retomar capítulo 5")).toBeTruthy();
    expect(screen.getByText(/Atualizado em/)).toBeTruthy();
  });

  it("planeja uma obra, permite priorizá-la e inicia a leitura pela lista", async () => {
    const user = userEvent.setup(); render(<Home />);
    await user.click(await screen.findByRole("button", { name: /Adicionar Zen speaks à lista Quero ler/ }));
    await waitFor(() => expect(testState.saveWantToRead).toHaveBeenCalledWith(expect.objectContaining({ bookUid: "book-isbn", priority: "Média", position: 0 })));
    const wantToReadNavigation = screen.getAllByRole("button", { name: /Quero ler/ }).find((button) => button.classList.contains("nav-item"));
    if (!wantToReadNavigation) throw new Error("Navegação Quero ler não encontrada.");
    await user.click(wantToReadNavigation);
    const priority = await screen.findByLabelText("Prioridade de Zen speaks");
    await user.selectOptions(priority, "Alta");
    await user.type(screen.getByPlaceholderText("Por que esta obra entra agora na sua fila?"), "Ler antes da próxima compra.");
    await user.click(screen.getByRole("button", { name: "Salvar planejamento" }));
    await waitFor(() => expect(testState.saveWantToRead).toHaveBeenLastCalledWith(expect.objectContaining({ priority: "Alta", note: "Ler antes da próxima compra." })));
    await user.click(screen.getByRole("button", { name: "Começar a ler" }));
    await waitFor(() => expect(testState.beginReading).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ bookUid: "book-isbn", type: "started" }) })));
    expect(await screen.findByText("O acervo também guarda o caminho da leitura.")).toBeTruthy();
  });

  it("hidrata a lista sincronizada e persiste uma nova ordem entre duas obras", async () => {
    testState.wantToRead = [{ uid: "want-zen", bookUid: "book-isbn", priority: "Média", note: "Depois de Duna", position: 1 }, { uid: "want-duna", bookUid: "book-second", priority: "Alta", note: "Próxima leitura", position: 0 }];
    const user = userEvent.setup(); render(<Home />);
    const wantToReadNavigation = (await screen.findAllByRole("button", { name: /Quero ler/ })).find((button) => button.classList.contains("nav-item"));
    if (!wantToReadNavigation) throw new Error("Navegação Quero ler não encontrada.");
    await user.click(wantToReadNavigation);
    await waitFor(() => expect(Array.from(document.querySelectorAll(".want-to-read-card h3")).map((heading) => heading.textContent)).toEqual(["Duna", "Zen speaks"]));
    await user.click(screen.getByRole("button", { name: "Subir Zen speaks" }));
    await waitFor(() => expect(testState.reorderWantToRead).toHaveBeenCalledWith({ uids: ["want-zen", "want-duna"] }));
    expect(Array.from(document.querySelectorAll(".want-to-read-card h3")).map((heading) => heading.textContent)).toEqual(["Zen speaks", "Duna"]);
  });

  it("avisa sobre Literatura Geral após sincronizar uma importação local e exporta o relatório", async () => {
    testState.hideRemoteBooks = true;
    localStorage.setItem("biblioteca-shinko-records-v1", JSON.stringify([{ uid: "local-general", raw: "Livro sem regra - Autor", title: "Livro sem regra", author: "AUTOR, Sem regra", media: "0L", genre: "60", slug: "SEMR", volume: "00", collection: "", seriesCode: "", seriesNumber: "", extension: "epub", shinkoId: "ST.0L.60.SEMR-00", filename: "livro-sem-regra.epub", classification: "Literatura Geral", confidence: "Revisar", warnings: ["Gênero sugerido por padrão; revise a classificação."], duplicate: false }]));
    const user = userEvent.setup(); render(<Home />);
    await waitFor(() => expect(testState.importBooks).toHaveBeenCalled());
    expect(testState.toastError).toHaveBeenCalledWith(expect.stringMatching(/Literatura Geral/));
    const monitorNavigation = (await screen.findAllByRole("button", { name: /Classificação/ })).find((button) => button.classList.contains("nav-item"));
    if (!monitorNavigation) throw new Error("Navegação Classificação não encontrada.");
    await user.click(monitorNavigation);
    expect(await screen.findByText("Limite de Literatura Geral atingido.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Exportar relatório" }));
    expect(testState.writeWorkbook).toHaveBeenCalledWith(expect.objectContaining({ SheetNames: ["Resumo", "Literatura Geral", "Autores recorrentes", "Termos recorrentes", "Coleções recorrentes", "Histórico"] }), expect.stringMatching(/^relatorio-classificacao-shinko-\d{4}-\d{2}-\d{2}\.xlsx$/));
  });
});

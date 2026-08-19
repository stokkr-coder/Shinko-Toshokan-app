import { describe, expect, it, vi } from "vitest";

const snapshot = {
  books: [{ uid: "book-1", raw: "Teste", title: "Teste", author: "AUTOR, Teste", media: "0L", genre: "60", slug: "AUTO", volume: "00", collection: "", seriesCode: "", seriesNumber: "", extension: "epub", shinkoId: "ST.0L.60.AUTO-00", filename: "teste.epub", classification: "Literatura", confidence: "Alta" as const, warnings: [], duplicate: false }],
  rules: [],
  assets: [],
  metadata: [],
  readingEvents: [],
  goals: [],
  wantToRead: [],
  classificationMonitorSettings: { uid: "monitor-42", alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "weekly" as const, reportEnabled: true, scheduleCronTaskUid: "", lastReportAt: null },
  classificationReports: [],
};

vi.mock("./db", () => ({
  createBackup: vi.fn(async () => ({ uid: "backup-1", ...snapshot, createdAt: new Date() })), createClassificationReport: vi.fn(async () => ({ uid: "report-1", source: "manual", periodStart: 1, periodEnd: 2, totalBooks: 12, generalCount: 3, reviewCount: 4, generalPercentBasisPoints: 2500, exceeded: true, summary: { topAuthors: [], topTerms: [], topCollections: [], generalBookUids: [] } })),
  createReadingEvent: vi.fn(async () => []), deleteAsset: vi.fn(), deleteBook: vi.fn(), deleteRule: vi.fn(), deleteWantToRead: vi.fn(),
  getClassificationDashboard: vi.fn(async () => ({ settings: snapshot.classificationMonitorSettings, totalBooks: 12, generalCount: 3, reviewCount: 4, generalPercentBasisPoints: 2500, exceeded: true, summary: { topAuthors: [], topTerms: [], topCollections: [], generalBookUids: [] }, latestReport: null })), getClassificationMonitorSettings: vi.fn(async () => snapshot.classificationMonitorSettings), getLibrarySnapshot: vi.fn(async () => snapshot), listAssets: vi.fn(async () => []), listBackups: vi.fn(async () => []), listBooks: vi.fn(async () => []), listClassificationReports: vi.fn(async () => []), listMetadata: vi.fn(async () => []), listReadingEvents: vi.fn(async () => []), listReadingGoals: vi.fn(async () => []),
  getGitHubBackupSettings: vi.fn(async () => ({ uid: "github-test", repository: "stokkr-coder/Shinko-Toshokan", enabled: false, scheduleCronTaskUid: "", lastBackupAt: null, lastBackupPath: "", lastCommitSha: "", lastError: "" })), listRules: vi.fn(async () => []), listWantToRead: vi.fn(async () => []), reorderWantToRead: vi.fn(async () => []), restoreBackup: vi.fn(async () => snapshot), restoreGitHubCatalog: vi.fn(async () => ({ bookCount: 1, ruleCount: 1 })), updateClassificationSchedule: vi.fn(async () => snapshot.classificationMonitorSettings), updateGitHubBackupSchedule: vi.fn(), upsertAsset: vi.fn(), upsertBook: vi.fn(), upsertBooks: vi.fn(async () => []), upsertClassificationMonitorSettings: vi.fn(async () => snapshot.classificationMonitorSettings), upsertGitHubBackupSettings: vi.fn(), upsertMetadata: vi.fn(), upsertReadingGoal: vi.fn(), upsertRule: vi.fn(), upsertWantToRead: vi.fn(),
}));
vi.mock("./storage", () => ({ storagePut: vi.fn(async () => ({ key: "library/test.pdf", url: "/manus-storage/library/test.pdf" })) }));
vi.mock("./isbn", () => ({ lookupIsbn: vi.fn(async () => ({ isbn: "9780385472579", title: "Zen speaks", subtitle: "", authors: ["Zhizhong Cai"], publisher: "Anchor Books", publishedDate: "1994", pageCount: 159, summary: "", coverUrl: "https://covers.example/zen.jpg", source: "Open Library", sourceUrl: "https://openlibrary.org/isbn/9780385472579" })), cacheIsbnCover: vi.fn(async () => ({ key: "library/cover.jpg", url: "/manus-storage/library/cover.jpg" })) }));
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(async () => ({ taskUid: "cron-2" })), updateHeartbeatJob: vi.fn(async () => ({})) }));
vi.mock("./githubBackup", () => ({ listGitHubCatalogBackups: vi.fn(async () => [{ path: "backups/2026-08-18/catalogo.json", size: 320 }]), readGitHubCatalogBackup: vi.fn(async () => ({ path: "backups/2026-08-18/catalogo.json", catalog: { books: snapshot.books, rules: snapshot.rules } })) }));
vi.mock("./githubBackupSchedule", () => ({ githubBackupCron: "0 0 6 * * *", runGitHubCatalogBackup: vi.fn() }));

import { createClassificationReport, createReadingEvent, deleteWantToRead, getClassificationDashboard, getClassificationMonitorSettings, getLibrarySnapshot, listBooks, listClassificationReports, listWantToRead, reorderWantToRead, restoreBackup, restoreGitHubCatalog, upsertAsset, upsertClassificationMonitorSettings, upsertMetadata, upsertReadingGoal, upsertRule, upsertWantToRead } from "./db";
import { updateHeartbeatJob } from "./_core/heartbeat";
import { cacheIsbnCover, lookupIsbn } from "./isbn";
import { storagePut } from "./storage";
import { readGitHubCatalogBackup } from "./githubBackup";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "biblioteca-user", name: "Shinko", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUnauthenticatedContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"] };
}

describe("library router", () => {
  it("retorna apenas o snapshot do usuário autenticado", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.library.snapshot();

    expect(result.books).toHaveLength(1);
    expect(getLibrarySnapshot).toHaveBeenCalledWith(42);
  });

  it("salva uma regra de coleção no escopo do usuário autenticado", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.library.rules.save({ uid: "rule-1", name: "Duna", matcher: "Duna", collection: "Duna", seriesCode: "DUNA", media: "0L", genre: "41", defaultAuthor: "HERBERT, Frank", active: true });

    expect(upsertRule).toHaveBeenCalledWith(42, expect.objectContaining({ collection: "Duna", active: true }));
  });

  it("bloqueia acesso ao snapshot sem uma sessão autenticada", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());
    await expect(caller.library.snapshot()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("exige um link válido para vínculo digital e salva o vínculo físico localizado", async () => {
    const caller = appRouter.createCaller(createContext());
    const baseAsset = { uid: "asset-1", bookUid: "book-1", label: "Kindle", location: "", sourceUrl: "", storageKey: "", storageUrl: "", mimeType: "", byteSize: 0 };
    await expect(caller.library.assets.save({ ...baseAsset, kind: "digital-link" })).rejects.toThrow("link digital válido");
    await caller.library.assets.save({ ...baseAsset, kind: "physical", location: "Estante A · 3" });
    expect(upsertAsset).toHaveBeenCalledWith(42, expect.objectContaining({ kind: "physical", location: "Estante A · 3" }));
  });

  it("envia um pequeno arquivo digital ao armazenamento e restaura um backup autenticado", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.library.assets.upload({ bookUid: "book-1", label: "nota.txt", fileName: "nota.txt", mimeType: "text/plain", base64: Buffer.from("Biblioteca Shinko").toString("base64") });
    expect(result.storageUrl).toBe("/manus-storage/library/test.pdf");
    expect(storagePut).toHaveBeenCalled();
    expect(upsertAsset).toHaveBeenCalledWith(42, expect.objectContaining({ kind: "digital-file", bookUid: "book-1" }));

    const restored = await caller.library.backups.restore({ uid: "backup-1" });
    expect(restored).toEqual(snapshot);
    expect(restoreBackup).toHaveBeenCalledWith(42, "backup-1");
  });

  it("restaura uma versão GitHub datada para o acervo autenticado", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.library.githubBackups.restoreVersion({ path: "backups/2026-08-18/catalogo.json" });

    expect(readGitHubCatalogBackup).toHaveBeenCalledWith("backups/2026-08-18/catalogo.json");
    expect(restoreGitHubCatalog).toHaveBeenCalledWith(42, expect.objectContaining({ books: snapshot.books, rules: snapshot.rules }));
    expect(result).toEqual({ path: "backups/2026-08-18/catalogo.json", bookCount: 1, ruleCount: 1 });
  });

  it("bloqueia caminho inválido e propaga erro ao recuperar uma versão GitHub", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.library.githubBackups.restoreVersion({ path: "latest/catalogo.json" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.mocked(readGitHubCatalogBackup).mockRejectedValueOnce(new Error("JSON incompatível"));
    await expect(caller.library.githubBackups.restoreVersion({ path: "backups/2026-08-18/catalogo.json" })).rejects.toThrow("JSON incompatível");
  });

  it("registra um evento de leitura no livro autenticado", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.library.reading.add({ uid: "reading-1", bookUid: "book-1", type: "progress", page: 48, progress: 32, note: "Capítulo 3", occurredAt: 1_700_000_000_000 });
    expect(createReadingEvent).toHaveBeenCalledWith(42, expect.objectContaining({ bookUid: "book-1", progress: 32, type: "progress" }));
  });

  it("salva metas mensais e anuais isoladas por usuário", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.library.readingGoals.save({ uid: "goal-2026-08", period: "monthly", periodKey: "2026-08", targetBooks: 4 });
    await caller.library.readingGoals.save({ uid: "goal-2026", period: "yearly", periodKey: "2026", targetBooks: 24 });
    expect(upsertReadingGoal).toHaveBeenNthCalledWith(1, 42, expect.objectContaining({ period: "monthly", periodKey: "2026-08", targetBooks: 4 }));
    expect(upsertReadingGoal).toHaveBeenNthCalledWith(2, 42, expect.objectContaining({ period: "yearly", periodKey: "2026", targetBooks: 24 }));
  });

  it("persiste limites e gera relatórios de Literatura Geral para o usuário autenticado", async () => {
    const caller = appRouter.createCaller(createContext());
    const dashboard = await caller.library.classificationMonitor.dashboard();
    const history = await caller.library.classificationMonitor.history();
    const report = await caller.library.classificationMonitor.runNow();
    await caller.library.classificationMonitor.saveSettings({ alertThresholdCount: 8, alertThresholdPercent: 12, reportFrequency: "monthly" });

    expect(getClassificationDashboard).toHaveBeenCalledWith(42);
    expect(listClassificationReports).toHaveBeenCalledWith(42);
    expect(createClassificationReport).toHaveBeenCalledWith(42, "manual");
    expect(upsertClassificationMonitorSettings).toHaveBeenCalledWith(42, expect.objectContaining({ alertThresholdCount: 8, alertThresholdPercent: 12, reportFrequency: "monthly" }));
    expect(dashboard.generalCount).toBe(3);
    expect(history).toEqual([]);
    expect(report.exceeded).toBe(true);
  });

  it("pausa o relatório periódico já agendado sem criar uma tarefa duplicada", async () => {
    const scheduledSettings = { ...snapshot.classificationMonitorSettings, scheduleCronTaskUid: "cron-1" };
    vi.mocked(getClassificationMonitorSettings).mockResolvedValueOnce(scheduledSettings);
    vi.mocked(upsertClassificationMonitorSettings).mockResolvedValueOnce(scheduledSettings);
    const caller = appRouter.createCaller(createContext());
    await caller.library.classificationMonitor.schedule({ enabled: false });

    expect(updateHeartbeatJob).toHaveBeenCalledWith("cron-1", expect.objectContaining({ enable: false, path: "/api/scheduled/classification-report" }), "");
  });

  it("atualiza o cron quando a frequência do relatório periódico muda", async () => {
    const scheduledSettings = { ...snapshot.classificationMonitorSettings, scheduleCronTaskUid: "cron-1", reportFrequency: "monthly" as const };
    vi.mocked(getClassificationMonitorSettings).mockResolvedValueOnce({ ...snapshot.classificationMonitorSettings, scheduleCronTaskUid: "cron-1" });
    vi.mocked(upsertClassificationMonitorSettings).mockResolvedValueOnce(scheduledSettings);
    const caller = appRouter.createCaller(createContext());
    await caller.library.classificationMonitor.saveSettings({ alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "monthly" });

    expect(updateHeartbeatJob).toHaveBeenCalledWith("cron-1", expect.objectContaining({ cron: "0 0 12 1 * *", enable: true }), "");
  });

  it("mantém o planejamento Quero ler no escopo autenticado e inicia a obra pelo diário", async () => {
    const caller = appRouter.createCaller(createContext());
    const item = { uid: "want-1", bookUid: "book-1", priority: "Alta" as const, note: "Ler em setembro", position: 0 };
    const secondItem = { uid: "want-2", bookUid: "book-2", priority: "Média" as const, note: "Ler depois", position: 1 };
    vi.mocked(listBooks).mockResolvedValueOnce([{ uid: "book-1" } as never]);
    vi.mocked(listWantToRead).mockResolvedValueOnce([item as never, secondItem as never]).mockResolvedValueOnce([item as never, secondItem as never]);

    await caller.library.wantToRead.save(item);
    await caller.library.wantToRead.reorder({ uids: ["want-2", "want-1"] });
    await caller.library.wantToRead.beginReading({ uid: "want-1", event: { uid: "event-1", bookUid: "book-1", type: "started", page: 0, progress: 0, note: "Começo", occurredAt: 1_700_000_000_000 } });

    expect(upsertWantToRead).toHaveBeenCalledWith(42, item);
    expect(reorderWantToRead).toHaveBeenCalledWith(42, ["want-2", "want-1"]);
    expect(createReadingEvent).toHaveBeenCalledWith(42, expect.objectContaining({ uid: "event-1", type: "started", bookUid: "book-1" }));
    expect(deleteWantToRead).toHaveBeenCalledWith(42, "want-1");
  });

  it("consulta ISBN e armazena a capa para revisão antes de persistir", async () => {
    const caller = appRouter.createCaller(createContext());
    vi.mocked(listBooks).mockResolvedValueOnce([{ uid: "book-1" } as never]);
    const result = await caller.library.metadata.lookupIsbn({ bookUid: "book-1", isbn: "9780385472579" });
    expect(lookupIsbn).toHaveBeenCalledWith("9780385472579");
    expect(cacheIsbnCover).toHaveBeenCalledWith(42, "9780385472579", "https://covers.example/zen.jpg");
    expect(upsertMetadata).not.toHaveBeenCalled();
    expect(result.title).toBe("Zen speaks");
    expect(result.coverUrl).toBe("/manus-storage/library/cover.jpg");
  });

  it("persiste os campos ISBN revisados no escopo do usuário autenticado", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.library.metadata.save({ bookUid: "book-1", isbn: "9780385472579", subtitle: "Edição revista", publisher: "Anchor Books", publishedDate: "1994", pageCount: 159, summary: "Assuntos: Zen Buddhism.", coverUrl: "/manus-storage/library/cover.jpg", coverStorageKey: "library/cover.jpg", source: "Open Library", sourceUrl: "https://openlibrary.org/isbn/9780385472579" });
    expect(upsertMetadata).toHaveBeenCalledWith(42, expect.objectContaining({ publisher: "Anchor Books", pageCount: 159, summary: "Assuntos: Zen Buddhism." }));
  });
});

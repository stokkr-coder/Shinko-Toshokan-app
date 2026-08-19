import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { parse as parseCookie } from "cookie";
import { createBackup, createClassificationReport, createReadingEvent, deleteAsset, deleteBook, deleteRule, deleteWantToRead, getClassificationDashboard, getClassificationMonitorSettings, getGitHubBackupSettings, getLibrarySnapshot, listAssets, listBackups, listBooks, listClassificationReports, listMetadata, listReadingEvents, listReadingGoals, listRules, listWantToRead, reorderWantToRead, restoreBackup, restoreGitHubCatalog, updateClassificationSchedule, updateGitHubBackupSchedule, upsertAsset, upsertBook, upsertBooks, upsertClassificationMonitorSettings, upsertGitHubBackupSettings, upsertMetadata, upsertReadingGoal, upsertRule, upsertWantToRead } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { cacheIsbnCover, lookupIsbn } from "./isbn";
import { storagePut } from "./storage";
import { runGitHubCatalogBackup } from "./githubBackupSchedule";
import { listGitHubCatalogBackups, readGitHubCatalogBackup } from "./githubBackup";

const bookSchema = z.object({ uid: z.string().min(1).max(96), raw: z.string().max(3000), title: z.string().min(1).max(3000), author: z.string().max(360), media: z.string().max(8), genre: z.string().max(8), slug: z.string().max(12), volume: z.string().max(12), collection: z.string().max(360), seriesCode: z.string().max(32), seriesNumber: z.string().max(160), extension: z.string().max(16), shinkoId: z.string().max(64), filename: z.string().max(4000), classification: z.string().max(420), confidence: z.enum(["Alta", "Média", "Revisar"]), warnings: z.array(z.string().max(320)).max(40), duplicate: z.boolean() });
const ruleSchema = z.object({ uid: z.string().min(1).max(96), name: z.string().min(1).max(180), matcher: z.string().min(1).max(400), collection: z.string().min(1).max(180), seriesCode: z.string().max(32), media: z.string().max(8), genre: z.string().max(8), defaultAuthor: z.string().max(360), active: z.boolean() });
const assetSchema = z.object({ uid: z.string().min(1).max(96), bookUid: z.string().min(1).max(96), kind: z.enum(["physical", "digital-link", "digital-file"]), label: z.string().min(1).max(240), location: z.string().max(480), sourceUrl: z.string().max(4000), storageKey: z.string().max(720), storageUrl: z.string().max(4000), mimeType: z.string().max(180), byteSize: z.number().int().min(0).max(15 * 1024 * 1024) });
const metadataSchema = z.object({ bookUid: z.string().min(1).max(96), isbn: z.string().min(10).max(32), subtitle: z.string().max(4000), publisher: z.string().max(360), publishedDate: z.string().max(32), pageCount: z.number().int().min(0).max(100_000), summary: z.string().max(20_000), coverUrl: z.string().max(4000), coverStorageKey: z.string().max(720), source: z.string().min(1).max(80), sourceUrl: z.string().max(4000) });
const readingEventSchema = z.object({ uid: z.string().min(1).max(96), bookUid: z.string().min(1).max(96), type: z.enum(["started", "progress", "finished", "abandoned", "note"]), page: z.number().int().min(0).max(1_000_000), progress: z.number().int().min(0).max(100), note: z.string().max(4_000), occurredAt: z.number().int().min(0).max(9_999_999_999_999) });
const readingGoalSchema = z.object({ uid: z.string().min(1).max(96), period: z.enum(["monthly", "yearly"]), periodKey: z.string().regex(/^\d{4}(?:-\d{2})?$/).max(16), targetBooks: z.number().int().min(1).max(10_000) });
const wantToReadSchema = z.object({ uid: z.string().min(1).max(96), bookUid: z.string().min(1).max(96), priority: z.enum(["Alta", "Média", "Baixa"]), note: z.string().max(4_000), position: z.number().int().min(0).max(100_000) });
const classificationMonitorSchema = z.object({ alertThresholdCount: z.number().int().min(1).max(100_000), alertThresholdPercent: z.number().int().min(1).max(100), reportFrequency: z.enum(["weekly", "monthly"]) });

const userId = (ctx: { user: { id: number } }) => ctx.user.id;
const safeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140) || "arquivo";
function validateAsset(asset: z.infer<typeof assetSchema>) {
  if (asset.kind === "physical" && !asset.location.trim()) throw new Error("Informe a localização do exemplar físico.");
  if (asset.kind === "digital-link") { try { const url = new URL(asset.sourceUrl); if (!/^https?:$/.test(url.protocol)) throw new Error("protocol"); } catch { throw new Error("Informe um link digital válido."); } }
  if (asset.kind === "digital-file" && (!asset.storageKey || !asset.storageUrl)) throw new Error("O arquivo digital precisa estar armazenado antes de ser associado.");
}
const classificationReportCron = (frequency: "weekly" | "monthly") => frequency === "weekly" ? "0 0 12 * * 1" : "0 0 12 1 * *";
const githubBackupCron = "0 0 6 * * *";
const sessionTokenFor = (ctx: { req: { headers: { cookie?: string } } }) => parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  library: router({
    snapshot: protectedProcedure.query(async ({ ctx }) => getLibrarySnapshot(userId(ctx))),
    books: protectedProcedure.query(async ({ ctx }) => listBooks(userId(ctx))),
    saveBook: protectedProcedure.input(bookSchema).mutation(async ({ ctx, input }) => { await upsertBook(userId(ctx), input); return { success: true } as const; }),
    importBooks: protectedProcedure.input(z.object({ books: z.array(bookSchema).min(1).max(3000) })).mutation(async ({ ctx, input }) => { const books = await upsertBooks(userId(ctx), input.books); const report = await createClassificationReport(userId(ctx), "import", { books: input.books }); return { count: books.length, report }; }),
    removeBook: protectedProcedure.input(z.object({ uid: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => { await deleteBook(userId(ctx), input.uid); return { success: true } as const; }),
    rules: router({ list: protectedProcedure.query(async ({ ctx }) => listRules(userId(ctx))), save: protectedProcedure.input(ruleSchema).mutation(async ({ ctx, input }) => { await upsertRule(userId(ctx), input); return { success: true } as const; }), remove: protectedProcedure.input(z.object({ uid: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => { await deleteRule(userId(ctx), input.uid); return { success: true } as const; }) }),
    assets: router({
      list: protectedProcedure.input(z.object({ bookUid: z.string().max(96).optional() }).optional()).query(async ({ ctx, input }) => listAssets(userId(ctx), input?.bookUid)),
      save: protectedProcedure.input(assetSchema).mutation(async ({ ctx, input }) => { validateAsset(input); await upsertAsset(userId(ctx), input); return { success: true } as const; }),
      upload: protectedProcedure.input(z.object({ bookUid: z.string().min(1).max(96), label: z.string().min(1).max(240), fileName: z.string().min(1).max(180), mimeType: z.string().max(180), base64: z.string().min(1).max(13_000_000) })).mutation(async ({ ctx, input }) => { const bytes = Buffer.from(input.base64, "base64"); if (!bytes.length || bytes.length > 9 * 1024 * 1024) throw new Error("O anexo deve ter até 9 MB."); const stored = await storagePut(`library/${userId(ctx)}/${input.bookUid}/${safeFileName(input.fileName)}`, bytes, input.mimeType || "application/octet-stream"); const asset = { uid: crypto.randomUUID(), bookUid: input.bookUid, kind: "digital-file" as const, label: input.label, location: "", sourceUrl: "", storageKey: stored.key, storageUrl: stored.url, mimeType: input.mimeType || "application/octet-stream", byteSize: bytes.length }; await upsertAsset(userId(ctx), asset); return asset; }),
      remove: protectedProcedure.input(z.object({ uid: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => { await deleteAsset(userId(ctx), input.uid); return { success: true } as const; }),
    }),
    metadata: router({
      list: protectedProcedure.query(async ({ ctx }) => listMetadata(userId(ctx))),
      save: protectedProcedure.input(metadataSchema).mutation(async ({ ctx, input }) => { await upsertMetadata(userId(ctx), input); return { success: true } as const; }),
      lookupIsbn: protectedProcedure.input(z.object({ bookUid: z.string().min(1).max(96), isbn: z.string().min(10).max(32) })).mutation(async ({ ctx, input }) => {
        if (!(await listBooks(userId(ctx))).some((book) => book.uid === input.bookUid)) throw new Error("Livro não encontrado no seu acervo.");
        const found = await lookupIsbn(input.isbn);
        const storedCover = await cacheIsbnCover(userId(ctx), found.isbn, found.coverUrl);
        const metadata = { bookUid: input.bookUid, isbn: found.isbn, subtitle: found.subtitle, publisher: found.publisher, publishedDate: found.publishedDate, pageCount: found.pageCount, summary: found.summary, coverUrl: storedCover.url || found.coverUrl, coverStorageKey: storedCover.key, source: found.source, sourceUrl: found.sourceUrl };
        return { ...found, ...metadata };
      }),
    }),
    reading: router({
      list: protectedProcedure.input(z.object({ bookUid: z.string().max(96).optional() }).optional()).query(async ({ ctx, input }) => listReadingEvents(userId(ctx), input?.bookUid)),
      add: protectedProcedure.input(readingEventSchema).mutation(async ({ ctx, input }) => createReadingEvent(userId(ctx), input)),
    }),
    readingGoals: router({ list: protectedProcedure.query(async ({ ctx }) => listReadingGoals(userId(ctx))), save: protectedProcedure.input(readingGoalSchema).mutation(async ({ ctx, input }) => { await upsertReadingGoal(userId(ctx), input); return { success: true } as const; }) }),
    wantToRead: router({
      list: protectedProcedure.query(async ({ ctx }) => listWantToRead(userId(ctx))),
      save: protectedProcedure.input(wantToReadSchema).mutation(async ({ ctx, input }) => { if (!(await listBooks(userId(ctx))).some((book) => book.uid === input.bookUid)) throw new Error("Livro não encontrado no seu acervo."); await upsertWantToRead(userId(ctx), input); return { success: true } as const; }),
      remove: protectedProcedure.input(z.object({ uid: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => { await deleteWantToRead(userId(ctx), input.uid); return { success: true } as const; }),
      reorder: protectedProcedure.input(z.object({ uids: z.array(z.string().min(1).max(96)).max(100_000) })).mutation(async ({ ctx, input }) => reorderWantToRead(userId(ctx), input.uids)),
      beginReading: protectedProcedure.input(z.object({ uid: z.string().min(1).max(96), event: readingEventSchema })).mutation(async ({ ctx, input }) => { const item = (await listWantToRead(userId(ctx))).find((candidate) => candidate.uid === input.uid); if (!item || item.bookUid !== input.event.bookUid) throw new Error("Item da lista não encontrado."); await createReadingEvent(userId(ctx), input.event); await deleteWantToRead(userId(ctx), input.uid); return { success: true } as const; }),
    }),
    classificationMonitor: router({
      settings: protectedProcedure.query(async ({ ctx }) => getClassificationMonitorSettings(userId(ctx))),
      saveSettings: protectedProcedure.input(classificationMonitorSchema).mutation(async ({ ctx, input }) => {
        const current = await getClassificationMonitorSettings(userId(ctx));
        const settings = await upsertClassificationMonitorSettings(userId(ctx), { ...current, ...input });
        if (settings.scheduleCronTaskUid) {
          await updateHeartbeatJob(settings.scheduleCronTaskUid, { cron: classificationReportCron(settings.reportFrequency), path: "/api/scheduled/classification-report", description: "Relatório de Literatura Geral da Biblioteca Shinko", enable: settings.reportEnabled }, sessionTokenFor(ctx));
        }
        return settings;
      }),
      dashboard: protectedProcedure.query(async ({ ctx }) => getClassificationDashboard(userId(ctx))),
      history: protectedProcedure.query(async ({ ctx }) => listClassificationReports(userId(ctx))),
      runNow: protectedProcedure.mutation(async ({ ctx }) => createClassificationReport(userId(ctx), "manual")),
      schedule: protectedProcedure.input(z.object({ enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
        const current = await getClassificationMonitorSettings(userId(ctx));
        const settings = await upsertClassificationMonitorSettings(userId(ctx), { ...current, reportEnabled: input.enabled });
        const sessionToken = sessionTokenFor(ctx);
        const cron = classificationReportCron(settings.reportFrequency);
        if (settings.scheduleCronTaskUid) {
          await updateHeartbeatJob(settings.scheduleCronTaskUid, { cron, path: "/api/scheduled/classification-report", description: "Relatório de Literatura Geral da Biblioteca Shinko", enable: input.enabled }, sessionToken);
          return settings;
        }
        if (!input.enabled) return settings;
        const job = await createHeartbeatJob({ name: `library-classification-${userId(ctx)}`, cron, path: "/api/scheduled/classification-report", payload: {}, description: "Relatório de Literatura Geral da Biblioteca Shinko" }, sessionToken);
        return updateClassificationSchedule(userId(ctx), job.taskUid);
      }),
    }),
    githubBackups: router({
      settings: protectedProcedure.query(async ({ ctx }) => getGitHubBackupSettings(userId(ctx))),
      runNow: protectedProcedure.mutation(async ({ ctx }) => runGitHubCatalogBackup(userId(ctx))),
      listVersions: protectedProcedure.query(async () => listGitHubCatalogBackups()),
      restoreVersion: protectedProcedure.input(z.object({ path: z.string().regex(/^backups\/\d{4}-\d{2}-\d{2}\/catalogo\.json$/) })).mutation(async ({ ctx, input }) => {
        const { catalog } = await readGitHubCatalogBackup(input.path);
        return { path: input.path, ...(await restoreGitHubCatalog(userId(ctx), catalog)) };
      }),
      schedule: protectedProcedure.input(z.object({ enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
        const current = await getGitHubBackupSettings(userId(ctx));
        const settings = await upsertGitHubBackupSettings(userId(ctx), { ...current, enabled: input.enabled });
        const sessionToken = sessionTokenFor(ctx);
        if (settings.scheduleCronTaskUid) {
          await updateHeartbeatJob(settings.scheduleCronTaskUid, { cron: githubBackupCron, path: "/api/scheduled/github-backup", description: "Backup diário da lista do acervo Shinko no GitHub", enable: input.enabled }, sessionToken);
          return settings;
        }
        if (!input.enabled) return settings;
        const job = await createHeartbeatJob({ name: `library-github-backup-${userId(ctx)}`, cron: githubBackupCron, path: "/api/scheduled/github-backup", payload: {}, description: "Backup diário da lista do acervo Shinko no GitHub" }, sessionToken);
        return updateGitHubBackupSchedule(userId(ctx), job.taskUid);
      }),
    }),
    backups: router({ list: protectedProcedure.query(async ({ ctx }) => listBackups(userId(ctx))), create: protectedProcedure.input(z.object({ label: z.string().min(1).max(240) })).mutation(async ({ ctx, input }) => createBackup(userId(ctx), input.label)), restore: protectedProcedure.input(z.object({ uid: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => restoreBackup(userId(ctx), input.uid)) }),
  }),
});

export type AppRouter = typeof appRouter;

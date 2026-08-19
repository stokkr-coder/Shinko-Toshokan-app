export const GITHUB_BACKUP_OWNER = "stokkr-coder";
export const GITHUB_BACKUP_REPOSITORY = "Shinko-Toshokan";
export const GITHUB_BACKUP_REPOSITORY_PATH = `${GITHUB_BACKUP_OWNER}/${GITHUB_BACKUP_REPOSITORY}`;

type GitHubRepositoryResponse = { private?: boolean; full_name?: string; default_branch?: string; message?: string };
type GitHubFileResponse = { sha?: string; content?: string; encoding?: string; message?: string };
type GitHubFileWriteResponse = { content?: { path?: string }; commit?: { sha?: string }; message?: string };
type GitHubTreeResponse = { tree?: Array<{ path?: string; type?: string; size?: number }>; message?: string };

export type GitHubCatalogBook = { uid: string; raw: string; title: string; author: string; media: string; genre: string; slug: string; volume: string; collection: string; seriesCode: string; seriesNumber: string; extension: string; shinkoId: string; filename: string; classification: string; confidence: "Alta" | "Média" | "Revisar"; warnings: string[]; duplicate: boolean };
export type GitHubCatalogRule = { uid: string; name: string; matcher: string; collection: string; seriesCode: string; media: string; genre: string; defaultAuthor: string; active: boolean };
export type GitHubCatalogSnapshot = { books: GitHubCatalogBook[]; rules: GitHubCatalogRule[] };

function getToken() {
  const token = process.env.GITHUB_BACKUP_TOKEN?.trim();
  if (!token) throw new Error("O token de backup do GitHub não foi configurado.");
  return token;
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${getToken()}`,
    "X-GitHub-Api-Version": "2026-03-10",
  };
}

function backupDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function minimalBook(book: GitHubCatalogBook) {
  return { uid: book.uid, raw: book.raw, title: book.title, author: book.author, media: book.media, genre: book.genre, slug: book.slug, volume: book.volume, collection: book.collection, seriesCode: book.seriesCode, seriesNumber: book.seriesNumber, extension: book.extension, shinkoId: book.shinkoId, filename: book.filename, classification: book.classification, confidence: book.confidence, warnings: book.warnings, duplicate: book.duplicate };
}

export function buildGitHubCatalogBackup(snapshot: GitHubCatalogSnapshot, now = new Date()) {
  return {
    format: "biblioteca-shinko-catalogo",
    version: 1,
    createdAt: now.toISOString(),
    timezone: "America/Sao_Paulo",
    counts: { books: snapshot.books.length, rules: snapshot.rules.length },
    books: snapshot.books.map(minimalBook),
    rules: snapshot.rules,
  };
}

async function getGitHubFile(path: string) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_BACKUP_REPOSITORY_PATH}/contents/${path}`, { headers: githubHeaders() });
  if (response.status === 404) return null;
  const payload = await response.json() as GitHubFileResponse;
  if (!response.ok) throw new Error(`Não foi possível acessar o arquivo de backup (${response.status}): ${payload.message || "erro desconhecido"}.`);
  return payload;
}

function assertCatalogPath(path: string) {
  if (!/^backups\/\d{4}-\d{2}-\d{2}\/catalogo\.json$/.test(path)) throw new Error("A versão selecionada não é um backup datado válido da Biblioteca Shinko.");
}

function parseGitHubCatalog(raw: unknown): ReturnType<typeof buildGitHubCatalogBackup> {
  if (!raw || typeof raw !== "object") throw new Error("O arquivo do GitHub não contém um catálogo válido.");
  const catalog = raw as Partial<ReturnType<typeof buildGitHubCatalogBackup>>;
  if (catalog.format !== "biblioteca-shinko-catalogo" || catalog.version !== 1 || !Array.isArray(catalog.books) || !Array.isArray(catalog.rules)) throw new Error("O arquivo selecionado não é compatível com esta versão da Biblioteca Shinko.");
  if (!catalog.books.every((book) => book && typeof book === "object" && typeof (book as { uid?: unknown }).uid === "string" && typeof (book as { title?: unknown }).title === "string")) throw new Error("A versão selecionada possui livros incompletos e não pode ser restaurada.");
  if (!catalog.rules.every((rule) => rule && typeof rule === "object" && typeof (rule as { uid?: unknown }).uid === "string" && typeof (rule as { matcher?: unknown }).matcher === "string")) throw new Error("A versão selecionada possui regras incompletas e não pode ser restaurada.");
  return catalog as ReturnType<typeof buildGitHubCatalogBackup>;
}

async function putGitHubFile(path: string, body: string, message: string) {
  const previous = await getGitHubFile(path);
  const response = await fetch(`https://api.github.com/repos/${GITHUB_BACKUP_REPOSITORY_PATH}/contents/${path}`, {
    method: "PUT",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: Buffer.from(body, "utf8").toString("base64"), ...(previous?.sha ? { sha: previous.sha } : {}) }),
  });
  const payload = await response.json() as GitHubFileWriteResponse;
  if (!response.ok || !payload.commit?.sha || !payload.content?.path) throw new Error(`Não foi possível gravar o backup no GitHub (${response.status}): ${payload.message || "resposta incompleta"}.`);
  return { path: payload.content.path, commitSha: payload.commit.sha };
}

export async function verifyGitHubBackupRepository() {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_BACKUP_REPOSITORY_PATH}`, {
    headers: githubHeaders(),
  });
  const payload = await response.json() as GitHubRepositoryResponse;
  if (!response.ok) throw new Error(`Não foi possível acessar o repositório de backup (${response.status}): ${payload.message || "erro desconhecido"}.`);
  if (payload.full_name !== GITHUB_BACKUP_REPOSITORY_PATH || !payload.private) throw new Error("O repositório de backup deve existir e permanecer privado.");
  return { repository: payload.full_name, branch: payload.default_branch || "main" };
}

export async function listGitHubCatalogBackups() {
  const repository = await verifyGitHubBackupRepository();
  const response = await fetch(`https://api.github.com/repos/${GITHUB_BACKUP_REPOSITORY_PATH}/git/trees/${encodeURIComponent(repository.branch)}?recursive=1`, { headers: githubHeaders() });
  const payload = await response.json() as GitHubTreeResponse;
  if (!response.ok) throw new Error(`Não foi possível listar as versões do GitHub (${response.status}): ${payload.message || "erro desconhecido"}.`);
  return (payload.tree || []).filter((entry) => entry.type === "blob" && typeof entry.path === "string" && /^backups\/\d{4}-\d{2}-\d{2}\/catalogo\.json$/.test(entry.path)).sort((left, right) => String(right.path).localeCompare(String(left.path))).map((entry) => ({ path: entry.path as string, size: entry.size || 0 }));
}

export async function readGitHubCatalogBackup(path: string) {
  assertCatalogPath(path);
  const file = await getGitHubFile(path);
  if (!file?.content || file.encoding !== "base64") throw new Error("A versão selecionada não pôde ser lida no GitHub.");
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8")); } catch { throw new Error("A versão selecionada contém JSON inválido."); }
  return { path, catalog: parseGitHubCatalog(decoded) };
}

export async function uploadGitHubCatalogBackup(snapshot: GitHubCatalogSnapshot, now = new Date()) {
  const document = buildGitHubCatalogBackup(snapshot, now);
  const body = `${JSON.stringify(document, null, 2)}\n`;
  const date = backupDate(now);
  const datedPath = `backups/${date}/catalogo.json`;
  const dated = await putGitHubFile(datedPath, body, `backup(shinko): catálogo de ${date}`);
  const latest = await putGitHubFile("latest/catalogo.json", body, `backup(shinko): atualizar catálogo atual — ${date}`);
  return { repository: GITHUB_BACKUP_REPOSITORY_PATH, path: dated.path, latestPath: latest.path, commitSha: latest.commitSha, createdAt: document.createdAt, counts: document.counts };
}

import { storagePut } from "./storage";

export type IsbnMetadata = { isbn: string; title: string; subtitle: string; authors: string[]; publisher: string; publishedDate: string; pageCount: number; summary: string; coverUrl: string; source: "Open Library"; sourceUrl: string };

const normalizedIsbn = (value: string) => value.toUpperCase().replace(/[^0-9X]/g, "");

export async function lookupIsbn(value: string): Promise<IsbnMetadata> {
  const isbn = normalizedIsbn(value);
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(isbn)) throw new Error("Informe um ISBN-10 ou ISBN-13 válido.");
  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(), 8_000);
  try {
    const endpoint = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
    const response = await fetch(endpoint, { signal: aborter.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("A consulta de ISBN não está disponível agora.");
    const payload = await response.json() as Record<string, any>;
    const book = payload[`ISBN:${isbn}`];
    if (!book) throw new Error("ISBN não encontrado na base consultada.");
    const authors = Array.isArray(book.authors) ? book.authors.map((author: { name?: string }) => String(author.name || "").trim()).filter(Boolean) : [];
    const publishers = Array.isArray(book.publishers) ? book.publishers.map((publisher: { name?: string }) => String(publisher.name || "").trim()).filter(Boolean) : [];
    const subjects = Array.isArray(book.subjects) ? book.subjects.map((subject: { name?: string }) => String(subject.name || "").trim()).filter(Boolean) : [];
    return { isbn, title: String(book.title || ""), subtitle: String(book.subtitle || ""), authors, publisher: publishers[0] || "", publishedDate: String(book.publish_date || ""), pageCount: Number(book.number_of_pages || 0), summary: subjects.length ? `Assuntos: ${subjects.slice(0, 6).join("; ")}.` : "", coverUrl: String(book.cover?.large || book.cover?.medium || ""), source: "Open Library", sourceUrl: String(book.url || `https://openlibrary.org/isbn/${isbn}`).replace(/^http:/, "https:") };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("A consulta de ISBN excedeu o tempo de resposta.");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function cacheIsbnCover(userId: number, isbn: string, coverUrl: string) {
  if (!coverUrl) return { key: "", url: "" };
  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(), 10_000);
  try {
    const response = await fetch(coverUrl, { signal: aborter.signal });
    if (!response.ok) return { key: "", url: "" };
    const size = Number(response.headers.get("content-length") || 0);
    if (size > 3 * 1024 * 1024) return { key: "", url: "" };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) return { key: "", url: "" };
    const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    return storagePut(`library/${userId}/covers/${isbn}.jpg`, bytes, contentType);
  } catch { return { key: "", url: "" }; } finally { clearTimeout(timer); }
}

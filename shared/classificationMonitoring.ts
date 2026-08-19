export type ClassificationMonitorBook = {
  uid: string;
  title: string;
  author: string;
  raw: string;
  media: string;
  genre: string;
  collection: string;
  confidence: "Alta" | "Média" | "Revisar";
  warnings?: string[];
};

export type ClassificationGroup = { label: string; count: number };

export type ClassificationReportSummary = {
  topAuthors: ClassificationGroup[];
  topTerms: ClassificationGroup[];
  topCollections: ClassificationGroup[];
  generalBookUids: string[];
};

export type ClassificationMetrics = {
  totalBooks: number;
  generalCount: number;
  reviewCount: number;
  generalPercentBasisPoints: number;
  exceeded: boolean;
  summary: ClassificationReportSummary;
};

const ignoredTerms = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "o", "os", "para", "por", "sem", "um", "uma", "the", "and", "book", "vol", "volume", "epub", "pdf", "mobi", "azw", "capitulo", "capítulo",
]);

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function rankedGroups(values: string[], fallback: string) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const label = value.trim() || fallback;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "pt-BR"))
    .slice(0, 6);
}

function recurringTerms(books: ClassificationMonitorBook[]) {
  const terms: string[] = [];
  books.forEach((book) => {
    const seen = new Set<string>();
    normalized(book.title || book.raw)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length >= 4 && !ignoredTerms.has(term))
      .forEach((term) => seen.add(term));
    terms.push(...Array.from(seen));
  });
  return rankedGroups(terms, "Sem termo recorrente");
}

export function isLiteraturaGeralPending(book: ClassificationMonitorBook) {
  return book.media === "0L" && book.genre === "60" && book.confidence === "Revisar";
}

export function calculateClassificationMetrics(
  books: ClassificationMonitorBook[],
  thresholds: { count: number; percent: number },
): ClassificationMetrics {
  const generalBooks = books.filter(isLiteraturaGeralPending);
  const reviewCount = books.filter((book) => book.confidence === "Revisar" || Boolean(book.warnings?.length)).length;
  const totalBooks = books.length;
  const generalPercentBasisPoints = totalBooks ? Math.round((generalBooks.length / totalBooks) * 10_000) : 0;
  const countExceeded = generalBooks.length >= Math.max(1, thresholds.count);
  const percentExceeded = totalBooks > 0 && generalPercentBasisPoints >= Math.max(1, thresholds.percent) * 100;
  return {
    totalBooks,
    generalCount: generalBooks.length,
    reviewCount,
    generalPercentBasisPoints,
    exceeded: countExceeded || percentExceeded,
    summary: {
      topAuthors: rankedGroups(generalBooks.map((book) => book.author), "Autor não identificado"),
      topTerms: recurringTerms(generalBooks),
      topCollections: rankedGroups(generalBooks.map((book) => book.collection), "Sem coleção"),
      generalBookUids: generalBooks.map((book) => book.uid),
    },
  };
}

export function reportWindowStart(frequency: "weekly" | "monthly", now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (frequency === "monthly") {
    start.setUTCDate(1);
    return start.getTime();
  }
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start.getTime();
}

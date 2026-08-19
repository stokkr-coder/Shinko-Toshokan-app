/**
 * Estilo Catálogo de Gabinete: mesa de catalogação assimétrica, papel marfim,
 * tinta verde-pinheiro e marcadores vermelho-cinábrio; a informação guia a composição.
 */
import * as XLSX from "xlsx";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { localOnlyRecords, mergeByUid } from "@shared/librarySync";
import { readLocalArchive } from "@shared/localArchive";
import { chooseRemoteCopy, restoreArchivedCopy } from "@shared/syncConflictFlow";
import { deriveReadingNow } from "@shared/readingNow";
import { calculateClassificationMetrics } from "@shared/classificationMonitoring";
import {
  AlertTriangle,
  ArrowUpRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FolderArchive,
  Library,
  ListFilter,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type LibraryView = "acervo" | "revisar" | "taxonomia" | "regras" | "classificacao" | "leitura" | "quero-ler" | "backup";
type RecordStatus = "all" | "review" | "duplicate" | "ready";

type BookRecord = {
  uid: string;
  raw: string;
  title: string;
  author: string;
  media: string;
  genre: string;
  slug: string;
  volume: string;
  collection: string;
  seriesCode: string;
  seriesNumber: string;
  extension: string;
  shinkoId: string;
  filename: string;
  classification: string;
  confidence: "Alta" | "Média" | "Revisar";
  warnings: string[];
  duplicate: boolean;
};

type EntryForm = Omit<BookRecord, "uid" | "warnings" | "duplicate" | "shinkoId" | "filename" | "classification" | "confidence"> & {
  uid?: string;
};

type AdvancedFilterCriteria = {
  query: string;
  status: RecordStatus;
  genre: string;
  author: string;
  collection: string;
  media: string;
  extension: string;
  confidence: string;
  assetState: string;
};

type SearchSort = "title" | "author" | "shinko";

type EditableRule = {
  uid: string;
  name: string;
  matcher: string;
  collection: string;
  seriesCode: string;
  media: string;
  genre: string;
  defaultAuthor: string;
  active: boolean;
};

type LinkedAsset = {
  uid: string;
  bookUid: string;
  kind: "physical" | "digital-link" | "digital-file";
  label: string;
  location: string;
  sourceUrl: string;
  storageKey: string;
  storageUrl: string;
  mimeType: string;
  byteSize: number;
};

type AssetForm = Omit<LinkedAsset, "uid" | "bookUid" | "storageKey" | "storageUrl" | "mimeType" | "byteSize">;

type BookMetadata = { bookUid: string; isbn: string; subtitle: string; publisher: string; publishedDate: string; pageCount: number; summary: string; coverUrl: string; coverStorageKey: string; source: string; sourceUrl: string };
type ReadingEvent = { uid: string; bookUid: string; type: "started" | "progress" | "finished" | "abandoned" | "note"; page: number; progress: number; note: string; occurredAt: number };
type ReadingGoal = { uid: string; period: "monthly" | "yearly"; periodKey: string; targetBooks: number };
type WantToReadItem = { uid: string; bookUid: string; priority: "Alta" | "Média" | "Baixa"; note: string; position: number };
type ClassificationMonitorSettings = { uid: string; alertThresholdCount: number; alertThresholdPercent: number; reportFrequency: "weekly" | "monthly"; reportEnabled: boolean; scheduleCronTaskUid: string; lastReportAt: number | null };
type ClassificationReport = { uid: string; source: "import" | "manual" | "scheduled"; periodStart: number; periodEnd: number; totalBooks: number; generalCount: number; reviewCount: number; generalPercentBasisPoints: number; exceeded: boolean; summary: { topAuthors: { label: string; count: number }[]; topTerms: { label: string; count: number }[]; topCollections: { label: string; count: number }[]; generalBookUids: string[] } };
type ClassificationDashboard = Omit<ReturnType<typeof calculateClassificationMetrics>, "exceeded"> & { settings: ClassificationMonitorSettings; exceeded: boolean; latestReport: ClassificationReport | null };

type BackupInfo = { uid: string; label: string; bookCount: number; ruleCount: number; assetCount: number; createdAt: Date };
type GitHubBackupSettings = { uid: string; repository: string; enabled: boolean; scheduleCronTaskUid: string; lastBackupAt: number | null; lastBackupPath: string; lastCommitSha: string; lastError: string };

const STORAGE_KEY = "biblioteca-shinko-records-v1";
const LOCAL_ARCHIVE_KEY = "biblioteca-shinko-local-archive-v1";

const mediaOptions = [
  { code: "0T", label: "Teologia & Estudos Religiosos" },
  { code: "0L", label: "Literatura & Ficção Geral" },
  { code: "3M", label: "Mangás & Light Novels" },
  { code: "4M", label: "Manhwas" },
  { code: "5M", label: "Manhuas" },
  { code: "1C", label: "Comics / HQs Ocidentais" },
];

const genreOptions = [
  { code: "01", label: "Católica · Patrística & Concílios" },
  { code: "02", label: "Católica · Escolástica & Doutrina" },
  { code: "03", label: "Católica · Ensaios & Apologética" },
  { code: "04", label: "Protestante · Sistemática & Reformada" },
  { code: "05", label: "Protestante · Sermões & Espiritualidade" },
  { code: "06", label: "Protestante · Apologética & Ensaios" },
  { code: "07", label: "Estudos Bíblicos & História da Igreja" },
  { code: "30", label: "Terror, Horror, Thriller & Gótico" },
  { code: "34", label: "Apocalíptica & Sobrevivência" },
  { code: "35", label: "Thriller Cristão & Sobrenatural" },
  { code: "41", label: "Ficção Científica & Space Opera" },
  { code: "42", label: "Sci-fi / Light Novel militar & Isekai" },
  { code: "43", label: "Universos expandidos & Viagem no Tempo" },
  { code: "51", label: "Fantasia Épica & Mítica" },
  { code: "55", label: "Ficção Cristã, Alegoria & Fantasia Teológica" },
  { code: "60", label: "Drama, Slice of Life & Literatura Geral" },
  { code: "75", label: "Mistério & Policial Confessional" },
  { code: "80", label: "Humor, Sátira & Crônicas" },
];

const taxonomyRows = [
  ["0T", "01", "Patrística & Concílios"],
  ["0T", "02", "Escolástica & Doutrina"],
  ["0T", "03", "Apologética Católica"],
  ["0T", "04–06", "Teologia Protestante"],
  ["0T", "07", "Estudos Bíblicos & História"],
  ["0L", "30", "Terror, Horror & Gótico"],
  ["0L", "34–35", "Apocalíptica & Thriller Cristão"],
  ["0L", "41–43", "Ficção Científica"],
  ["0L", "51", "Fantasia Épica & Mítica"],
  ["0L", "55", "Ficção Cristã & Alegoria"],
  ["0L", "60", "Literatura Geral"],
  ["0L", "75–80", "Mistério & Humor"],
  ["3M", "42", "Light Novel / Isekai militar"],
];

function normalizeText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[_]+/g, " ")
    .replace(/\s*([-])\s*/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function titleKey(value: string) {
  return withoutAccents(value).toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
}

function cleanExtension(raw: string) {
  const found = raw.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return found?.toLowerCase() || "epub";
}

const authorAliases: Record<string, string> = {
  "santo agostinho": "AGOSTINHO, Santo",
  "santo atanasio": "ATANÁSIO, Santo",
  "sao joao crisostomo": "CRISÓSTOMO, São João",
  "sao jeronimo": "JERÔNIMO, São",
  "santo hilario de poitiers": "HILÁRIO DE POITIERS, Santo",
  "eusebio de cesareia": "EUSÉBIO DE CESAREIA, Santo",
  "irineu de lyon": "IRINEU DE LYON, Santo",
  "irineu de liao": "IRINEU DE LIÃO, Santo",
  "origenes": "ORÍGENES",
  "ambrosio de milao": "AMBRÓSIO DE MILÃO, Santo",
  "leao magno": "LEÃO MAGNO, São",
  "gregorio magno": "GREGÓRIO MAGNO, São",
  "gregorio de nissa": "GREGÓRIO DE NISSA, São",
  "cipriano de cartago": "CIPRIANO DE CARTAGO, São",
};

function normalizeAuthor(value: string) {
  const cleaned = normalizeText(value)
    .replace(/^\((.*)\)$/, "$1")
    .replace(/\s*\((?:en|pt|es|fr|de)\)$/i, "")
    .trim();
  if (!cleaned || /^(?:a confirmar|desconhecido)$/i.test(cleaned)) return "";
  const alias = authorAliases[withoutAccents(cleaned).toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim()];
  if (alias) return alias;

  if (cleaned.includes(",")) {
    const [surname, ...firstNames] = cleaned.split(",");
    return `${surname.trim().toLocaleUpperCase("pt-BR")}, ${firstNames.join(",").trim()}`.replace(/,\s*$/, "");
  }

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].toLocaleUpperCase("pt-BR");
  const surname = parts.at(-1) || "";
  const givenNames = parts.slice(0, -1).join(" ");
  return `${surname.toLocaleUpperCase("pt-BR")}, ${givenNames}`;
}

function makeSlug(author: string) {
  const surname = withoutAccents((author.split(",")[0] || "ANON").replace(/[^A-Za-z]/g, "").toUpperCase());
  return `${surname}XXXX`.slice(0, 4);
}

function extractVolume(title: string) {
  const match = title.match(/\b(?:vol(?:ume)?\.?|v\.)\s*(\d{1,3})(?:[._-](\d{1,2}))?\b/i);
  if (!match) return { volume: "00", hasPart: false };
  return { volume: match[1].padStart(2, "0").slice(-2), hasPart: Boolean(match[2]) };
}

type CollectionRule = {
  collection: string;
  seriesCode: string;
  seriesNumber: string;
  title?: string;
  volume?: string;
  hasPart?: boolean;
  author?: string;
  media?: string;
  genre?: string;
};

function detectCollection(raw: string, currentTitle: string): CollectionRule {
  const source = raw.replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  const collectionSource = source.replace(/^[^–—-]+,\s*[^–—-]+\s*[-–—]\s*/i, "");
  const bracketedSeries = collectionSource.match(/^\s*\[([^\]]*?)\s+(\d{1,3})\]\s*(.+)$/);
  if (bracketedSeries) {
    const collection = normalizeText(bracketedSeries[1]);
    const issue = bracketedSeries[2].padStart(2, "0");
    const seriesCode = withoutAccents(collection).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4) || "SER";
    return { collection, seriesCode, seriesNumber: `Livro ${issue}`, title: normalizeText(bracketedSeries[3]), volume: issue };
  }
  const patristica = collectionSource.match(/^\s*patr[ií]stica\s+vol(?:ume)?\.?\s*(\d{1,3})(?:\s*[_\-.]\s*(\d{1,2}))?\s*-\s*(.+)$/i);
  if (patristica) {
    const volume = patristica[1].padStart(2, "0").slice(-2);
    const part = patristica[2]?.padStart(2, "0");
    const workTitle = currentTitle.replace(/^patr[ií]stica\s+vol(?:ume)?\.?\s*\d{1,3}(?:\s+\d{1,2})?\s*-\s*/i, "").trim();
    return {
      collection: "Patrística",
      seriesCode: "PATR",
      seriesNumber: `Vol. ${volume}${part ? ` · parte ${part}` : ""}`,
      title: `Patrística Vol. ${volume}${part ? `.${part}` : ""} — ${workTitle}`,
      volume: part ? `${volume}.${part}` : volume,
      hasPart: Boolean(part),
      media: "0T",
      genre: "01",
    };
  }
  const perry = collectionSource.match(/^\s*perry\s+rhodan\s*-\s*(?:pr\s*)?(\d{1,5})\s*-\s*(.+)$/i);
  if (perry) {
    const issue = perry[1].padStart(4, "0");
    const seriesCode = `PR${issue}`;
    const workTitle = currentTitle.replace(/^perry\s+rhodan\s*-\s*(?:pr\s*)?\d{1,5}\s*-\s*/i, "").trim();
    return { collection: "Perry Rhodan", seriesCode, seriesNumber: `Edição ${perry[1]}`, title: `Perry Rhodan ${seriesCode} — ${workTitle}`, media: "0L", genre: "41" };
  }
  if (/perry\s+rhodan/i.test(collectionSource)) return { collection: "Perry Rhodan", seriesCode: "PR", seriesNumber: "Edição a confirmar", media: "0L", genre: "41" };

  const harbingers = collectionSource.match(/^\s*harbingers\s*-\s*(?:book\s*)?(\d{1,3})\s*-\s*(.+)$/i);
  if (harbingers) {
    const issue = harbingers[1].padStart(2, "0");
    const workTitle = currentTitle.replace(/^harbingers\s*-\s*(?:book\s*)?\d{1,3}\s*-\s*/i, "").trim();
    return { collection: "Harbingers", seriesCode: "HARB", seriesNumber: `Livro ${issue}`, title: `Harbingers Livro ${issue} — ${workTitle}`, volume: issue, media: "0L", genre: "35" };
  }

  const starWars = collectionSource.match(/^\s*star\s+wars\s*-\s*(.+)$/i);
  if (starWars) {
    const issue = collectionSource.match(/\)\s*(\d{1,3})\s*-/)?.[1] || collectionSource.match(/-\s*(\d{1,3})\s*-/)?.[1] || "";
    const code = issue ? `SW${issue.padStart(2, "0")}` : "SW";
    return { collection: "Star Wars", seriesCode: code, seriesNumber: issue ? `Edição ${issue}` : "Edição a confirmar", media: "0L", genre: "43" };
  }

  const battlestar = collectionSource.match(/^\s*battlestar\s+galactica(?:\s+reboot)?\s*(\d{1,3})\s*-\s*(.+)$/i);
  if (battlestar) {
    const issue = battlestar[1].padStart(2, "0");
    const workTitle = currentTitle.replace(/^battlestar\s+galactica(?:\s+reboot)?\s*\d{1,3}\s*-\s*/i, "").trim();
    return { collection: "Battlestar Galactica", seriesCode: "BSG", seriesNumber: `Edição ${issue}`, title: `Battlestar Galactica ${issue} — ${workTitle}`, volume: issue, media: "0L", genre: "41" };
  }

  const youjo = collectionSource.match(/^\s*youjo\s+senki\s+(?:vol(?:ume)?\.?\s*)?(\d{1,3})(?:\s*-\s*(.+))?$/i);
  if (youjo) {
    const volume = youjo[1].padStart(2, "0");
    return { collection: "Youjo Senki", seriesCode: "YOUJ", seriesNumber: `Vol. ${volume}`, title: `Youjo Senki Vol. ${volume}`, volume, author: "ZEN, Carlo", media: "3M", genre: "42" };
  }

  const tokyoRavens = collectionSource.match(/^\s*tokyo\s+ravens\s+vol(?:ume)?\.?\s*(\d{1,3})(?:\s+completo)?/i);
  if (tokyoRavens) {
    const volume = tokyoRavens[1].padStart(2, "0");
    return { collection: "Tokyo Ravens", seriesCode: "TOKR", seriesNumber: `Vol. ${volume}`, title: `Tokyo Ravens Vol. ${volume}`, volume, media: "3M", genre: "42" };
  }

  const twelveKingdoms = collectionSource.match(/^\s*the\s+twelve\s+kingdoms\s*-\s*novel\s*(\d{1,3})/i);
  if (twelveKingdoms) {
    const volume = twelveKingdoms[1].padStart(2, "0");
    return { collection: "The Twelve Kingdoms", seriesCode: "TWEL", seriesNumber: `Novel ${volume}`, volume, media: "3M", genre: "42" };
  }

  const tempoComVoce = collectionSource.match(/^\s*o\s+tempo\s+com\s+voc[eê]\s*-\s*cap[ií]tulo\s*(\d{1,3})/i);
  if (tempoComVoce) return { collection: "O Tempo com Você", seriesCode: "OTCV", seriesNumber: `Capítulo ${tempoComVoce[1].padStart(2, "0")}` };
  return { collection: "", seriesCode: "", seriesNumber: "" };
}

function classifyBook(title: string, author: string) {
  const source = withoutAccents(`${title} ${author}`).toLowerCase();
  const certain = (media: string, genre: string) => ({ media, genre, confidence: "Alta" as const });
  const probable = (media: string, genre: string) => ({ media, genre, confidence: "Média" as const });

  if (/patristica|padres apostolicos|irineu|origenes|at[aã]nasio|agostinho|jeronimo|ambr[oó]sio|crisostomo|eusebio/.test(source)) return certain("0T", "01");
  if (/suma teologica|tom[aá]s de aquino|escolastica|merton|padre pio|m[ií]stica/.test(source)) return certain("0T", "02");
  if (/padre brown|mist[eé]rio confessional/.test(source)) return certain("0L", "75");
  if (/chesterton|ortodoxia|homem eterno/.test(source)) return probable("0T", "03");
  if (/spurgeon|puritan|bunyan|serm[oõ]es|devocional/.test(source)) return probable("0T", "05");
  if (/calvino|bavinck|reformad/.test(source)) return probable("0T", "04");
  if (/lewis|apolog[eé]tica|cristianismo puro/.test(source) && !/narnia/.test(source)) return probable("0T", "06");
  if (/b[ií]blia|b[ií]blico|ap[oó]crifo|hist[oó]ria eclesi[aá]stica/.test(source)) return probable("0T", "07");
  if (/perry rhodan/.test(source)) return certain("0L", "41");
  if (/youjo senki|light novel|isekai/.test(source)) return certain("3M", "42");
  if (/mang[aá]|cap[ií]tulo \d+/.test(source)) return probable("3M", "60");
  if (/lovecraft|stephen king|horror|terror|g[oó]tico/.test(source)) return probable("0L", "30");
  if (/zumbi|zombies|mortos|apocal[ií]p/.test(source)) return probable("0L", "34");
  if (/peretti|guerra espiritual|tenebroso|harbingers/.test(source)) return probable("0L", "35");
  if (/doctor who|star trek|viagem no tempo/.test(source)) return probable("0L", "43");
  if (/tolkien|pendragon|merlin|fantasia [eé]pica/.test(source)) return probable("0L", "51");
  if (/narnia|peregrino|fic[cç][aã]o crist[aã]|alegoria/.test(source)) return probable("0L", "55");
  if (/humor|s[aá]tira|cr[oô]nica/.test(source)) return probable("0L", "80");
  return { media: "0L", genre: "60", confidence: "Revisar" as const };
}

function classificationLabel(genre: string) {
  return genreOptions.find((option) => option.code === genre)?.label || "Classificação a confirmar";
}

function generatedFields(form: Pick<EntryForm, "title" | "author" | "media" | "genre" | "slug" | "volume" | "extension">) {
  const shinkoId = `ST.${form.media || "0L"}.${(form.genre || "60").padStart(2, "0")}.${(form.slug || "ANON").toUpperCase()}-${(form.volume || "00").padStart(2, "0")}`;
  const filename = `${shinkoId} - ${form.title || "Título a confirmar"} - ${form.author || "AUTOR, A confirmar"}.${form.extension || "epub"}`;
  return { shinkoId, filename };
}

function parseRawBook(raw: string, uid: string = crypto.randomUUID()): BookRecord {
  const extension = cleanExtension(raw);
  const trimmed = normalizeText(raw.replace(/\.[a-z0-9]{2,5}$/i, ""));
  let title = trimmed;
  let authorCandidate = "";
  let inference = "Revisar" as BookRecord["confidence"];

  const leadingAuthor = trimmed.match(/^([^\-]+,[^\-]+)\s+-\s+(.+)$/);
  const finalParentheses = trimmed.match(/^(.*?)\s*\(([^()]{3,})\)\s*$/);
  const lastDivider = trimmed.lastIndexOf(" - ");

  if (leadingAuthor) {
    authorCandidate = leadingAuthor[1];
    title = leadingAuthor[2];
    inference = "Alta";
  } else if (finalParentheses && !/\b(?:en|pt|es|fr|de)\b/i.test(finalParentheses[2])) {
    title = finalParentheses[1];
    authorCandidate = finalParentheses[2];
    inference = "Média";
  } else if (lastDivider > 0) {
    title = trimmed.slice(0, lastDivider).trim();
    authorCandidate = trimmed.slice(lastDivider + 3).trim();
    inference = "Média";
  }

  const collectionRule = detectCollection(raw, title);
  title = collectionRule.title || title;
  const author = collectionRule.author || normalizeAuthor(authorCandidate);
  const extractedVolume = extractVolume(title);
  const volumeResult = collectionRule.volume ? { volume: collectionRule.volume, hasPart: Boolean(collectionRule.hasPart) } : extractedVolume;
  const classification = collectionRule.media && collectionRule.genre
    ? { media: collectionRule.media, genre: collectionRule.genre, confidence: "Alta" as const }
    : classifyBook(title, author);
  const slug = makeSlug(author);
  const warnings: string[] = [];

  if (!author) warnings.push("Autor não identificado automaticamente.");
  if (classification.confidence === "Revisar") warnings.push("Gênero sugerido por padrão; revise a classificação.");
  if (volumeResult.hasPart) warnings.push("Volume com parte detectada; confirme a ordem das partes.");
  if (inference === "Revisar") warnings.push("Estrutura do nome original pede revisão manual.");

  const form = {
    raw,
    title,
    author,
    media: classification.media,
    genre: classification.genre,
    slug,
    volume: volumeResult.volume,
    collection: collectionRule.collection,
    seriesCode: collectionRule.seriesCode,
    seriesNumber: collectionRule.seriesNumber,
    extension,
  };
  const { shinkoId, filename } = generatedFields(form);
  return {
    uid,
    ...form,
    shinkoId,
    filename,
    classification: classificationLabel(classification.genre),
    confidence: warnings.length ? classification.confidence === "Alta" ? "Média" : classification.confidence : classification.confidence,
    warnings,
    duplicate: false,
  };
}

function normalizeLibrary(records: BookRecord[]) {
  const enrichedRecords = records.map((record) => {
    const inferredCollection = detectCollection(record.raw || record.title, record.title);
    return { ...record, collection: record.collection || inferredCollection.collection, seriesCode: record.seriesCode || inferredCollection.seriesCode, seriesNumber: record.seriesNumber || inferredCollection.seriesNumber };
  });
  const titleCounts = enrichedRecords.reduce<Record<string, number>>((acc, record) => {
    const key = titleKey(`${record.title}|${record.author}`);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const idCounts = enrichedRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.shinkoId] = (acc[record.shinkoId] || 0) + 1;
    return acc;
  }, {});

  return enrichedRecords.map((record) => {
    const isDuplicate = titleCounts[titleKey(`${record.title}|${record.author}`)] > 1 || idCounts[record.shinkoId] > 1;
    const warnings = record.warnings.filter((warning) => warning !== "Possível duplicidade no acervo.");
    if (isDuplicate) warnings.push("Possível duplicidade no acervo.");
    return { ...record, warnings, duplicate: isDuplicate };
  });
}

function matchesAdvancedFilters(record: BookRecord, filters: AdvancedFilterCriteria) {
  const normalizedQuery = withoutAccents(filters.query).toLowerCase();
  const matchesQuery = !normalizedQuery || withoutAccents(`${record.raw} ${record.title} ${record.author} ${record.collection} ${record.seriesCode} ${record.seriesNumber} ${record.shinkoId} ${record.classification}`).toLowerCase().includes(normalizedQuery);
  const matchesStatus = filters.status === "all" || (filters.status === "review" && record.warnings.length > 0) || (filters.status === "duplicate" && record.duplicate) || (filters.status === "ready" && record.warnings.length === 0 && !record.duplicate);
  return matchesQuery && matchesStatus && (filters.genre === "all" || record.genre === filters.genre) && (filters.author === "all" || record.author === filters.author) && (filters.collection === "all" || record.collection === filters.collection) && (filters.media === "all" || record.media === filters.media) && (filters.extension === "all" || record.extension === filters.extension) && (filters.confidence === "all" || record.confidence === filters.confidence);
}

function applyEditableRule(record: BookRecord, rules: EditableRule[]) {
  const source = withoutAccents(record.raw).toLocaleLowerCase("pt-BR");
  const rule = rules.find((item) => item.active && source.includes(withoutAccents(item.matcher).toLocaleLowerCase("pt-BR")));
  if (!rule) return record;
  const author = rule.defaultAuthor ? normalizeAuthor(rule.defaultAuthor) : record.author;
  const merged = { ...record, author, collection: rule.collection || record.collection, seriesCode: rule.seriesCode || record.seriesCode, media: rule.media || record.media, genre: rule.genre || record.genre, slug: author ? makeSlug(author) : record.slug, classification: classificationLabel(rule.genre || record.genre), confidence: "Alta" as const };
  const { shinkoId, filename } = generatedFields(merged);
  return { ...merged, shinkoId, filename };
}

function parseBookWithRules(raw: string, rules: EditableRule[]) {
  return applyEditableRule(parseRawBook(raw), rules);
}

function recordFromForm(form: EntryForm, rules: EditableRule[] = []): BookRecord {
  const parsed = applyEditableRule(parseRawBook(form.raw || `${form.title} - ${form.author}`, form.uid || crypto.randomUUID()), rules);
  const completed = { ...parsed, ...form, author: normalizeAuthor(form.author), slug: (form.slug || makeSlug(form.author)).toUpperCase() };
  const { shinkoId, filename } = generatedFields(completed);
  const warnings = completed.warnings.filter((warning) => !warning.includes("Autor não identificado"));
  if (!completed.author) warnings.push("Autor não identificado automaticamente.");
  if (!completed.title) warnings.push("Título é obrigatório.");
  if (!genreOptions.some((option) => option.code === completed.genre)) warnings.push("Gênero fora da taxonomia; revise o código.");
  return {
    ...completed,
    shinkoId,
    filename,
    classification: classificationLabel(completed.genre),
    confidence: warnings.length ? "Revisar" : completed.confidence,
    warnings,
    duplicate: false,
  };
}

const emptyForm: EntryForm = { raw: "", title: "", author: "", media: "0L", genre: "60", slug: "ANON", volume: "00", collection: "", seriesCode: "", seriesNumber: "", extension: "epub" };
const emptyRule: EditableRule = { uid: "", name: "", matcher: "", collection: "", seriesCode: "", media: "0L", genre: "60", defaultAuthor: "", active: true };
const emptyAsset: AssetForm = { kind: "physical", label: "", location: "", sourceUrl: "" };

function asBookRecord(record: Record<string, unknown>): BookRecord {
  let warnings: string[] = [];
  try { warnings = JSON.parse(String(record.warningsJson || "[]")) as string[]; } catch { warnings = []; }
  return { uid: String(record.uid), raw: String(record.raw), title: String(record.title), author: String(record.author), media: String(record.media), genre: String(record.genre), slug: String(record.slug), volume: String(record.volume), collection: String(record.collection), seriesCode: String(record.seriesCode), seriesNumber: String(record.seriesNumber), extension: String(record.extension), shinkoId: String(record.shinkoId), filename: String(record.filename), classification: String(record.classification), confidence: record.confidence as BookRecord["confidence"], warnings, duplicate: Number(record.duplicate) === 1 };
}

function asEditableRule(rule: Record<string, unknown>): EditableRule {
  return { uid: String(rule.uid), name: String(rule.name), matcher: String(rule.matcher), collection: String(rule.collection), seriesCode: String(rule.seriesCode), media: String(rule.media), genre: String(rule.genre), defaultAuthor: String(rule.defaultAuthor), active: Number(rule.active) === 1 };
}

function asLinkedAsset(asset: Record<string, unknown>): LinkedAsset {
  return { uid: String(asset.uid), bookUid: String(asset.bookUid), kind: asset.kind as LinkedAsset["kind"], label: String(asset.label), location: String(asset.location), sourceUrl: String(asset.sourceUrl), storageKey: String(asset.storageKey), storageUrl: String(asset.storageUrl), mimeType: String(asset.mimeType), byteSize: Number(asset.byteSize) };
}

function asBookMetadata(metadata: Record<string, unknown>): BookMetadata {
  return { bookUid: String(metadata.bookUid), isbn: String(metadata.isbn), subtitle: String(metadata.subtitle), publisher: String(metadata.publisher), publishedDate: String(metadata.publishedDate), pageCount: Number(metadata.pageCount), summary: String(metadata.summary), coverUrl: String(metadata.coverUrl), coverStorageKey: String(metadata.coverStorageKey), source: String(metadata.source), sourceUrl: String(metadata.sourceUrl) };
}

function asReadingEvent(event: Record<string, unknown>): ReadingEvent {
  return { uid: String(event.uid), bookUid: String(event.bookUid), type: event.type as ReadingEvent["type"], page: Number(event.page), progress: Number(event.progress), note: String(event.note), occurredAt: Number(event.occurredAt) };
}

function asReadingGoal(goal: Record<string, unknown>): ReadingGoal {
  return { uid: String(goal.uid), period: goal.period as ReadingGoal["period"], periodKey: String(goal.periodKey), targetBooks: Number(goal.targetBooks) };
}

function asWantToReadItem(item: Record<string, unknown>): WantToReadItem {
  return { uid: String(item.uid), bookUid: String(item.bookUid), priority: item.priority as WantToReadItem["priority"], note: String(item.note), position: Number(item.position) };
}

function readingPeriodKeys(reference = new Date()) {
  const year = String(reference.getFullYear());
  return { yearly: year, monthly: `${year}-${String(reference.getMonth() + 1).padStart(2, "0")}` };
}

function completedBooksForPeriod(events: ReadingEvent[], period: "monthly" | "yearly", key: string) {
  return new Set(events.filter((event) => event.type === "finished" && (period === "yearly" ? String(new Date(event.occurredAt).getFullYear()) === key : `${new Date(event.occurredAt).getFullYear()}-${String(new Date(event.occurredAt).getMonth() + 1).padStart(2, "0")}` === key)).map((event) => event.bookUid)).size;
}

function initialLocalRecords() {
  if (typeof window === "undefined") return [] as BookRecord[];
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeLibrary(JSON.parse(saved) as BookRecord[]) : [];
  } catch { return [] as BookRecord[]; }
}

function initialLocalArchive() {
  if (typeof window === "undefined") return [] as BookRecord[];
  return normalizeLibrary(readLocalArchive<BookRecord>(window.localStorage, LOCAL_ARCHIVE_KEY));
}

export const catalogationDiagnostics = { detectCollection, matchesAdvancedFilters, normalizeAuthor, parseRawBook };

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  const { user, loading, isAuthenticated, logout } = useAuth();
  const cloud = trpc.useUtils();
  const snapshotQuery = trpc.library.snapshot.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const rulesQuery = trpc.library.rules.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const assetsQuery = trpc.library.assets.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const metadataQuery = trpc.library.metadata.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const readingQuery = trpc.library.reading.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const readingGoalsQuery = trpc.library.readingGoals.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const wantToReadQuery = trpc.library.wantToRead.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const classificationDashboardQuery = trpc.library.classificationMonitor.dashboard.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const classificationHistoryQuery = trpc.library.classificationMonitor.history.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const backupsQuery = trpc.library.backups.list.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const githubBackupSettingsQuery = trpc.library.githubBackups.settings.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const githubBackupVersionsQuery = trpc.library.githubBackups.listVersions.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const importBooksMutation = trpc.library.importBooks.useMutation();
  const saveBookMutation = trpc.library.saveBook.useMutation();
  const removeBookMutation = trpc.library.removeBook.useMutation();
  const saveRuleMutation = trpc.library.rules.save.useMutation();
  const removeRuleMutation = trpc.library.rules.remove.useMutation();
  const saveAssetMutation = trpc.library.assets.save.useMutation();
  const uploadAssetMutation = trpc.library.assets.upload.useMutation();
  const removeAssetMutation = trpc.library.assets.remove.useMutation();
  const createBackupMutation = trpc.library.backups.create.useMutation();
  const restoreBackupMutation = trpc.library.backups.restore.useMutation();
  const lookupIsbnMutation = trpc.library.metadata.lookupIsbn.useMutation();
  const saveMetadataMutation = trpc.library.metadata.save.useMutation();
  const addReadingMutation = trpc.library.reading.add.useMutation();
  const saveReadingGoalMutation = trpc.library.readingGoals.save.useMutation();
  const saveWantToReadMutation = trpc.library.wantToRead.save.useMutation();
  const removeWantToReadMutation = trpc.library.wantToRead.remove.useMutation();
  const reorderWantToReadMutation = trpc.library.wantToRead.reorder.useMutation();
  const beginReadingMutation = trpc.library.wantToRead.beginReading.useMutation();
  const saveClassificationSettingsMutation = trpc.library.classificationMonitor.saveSettings.useMutation();
  const runClassificationReportMutation = trpc.library.classificationMonitor.runNow.useMutation();
  const scheduleClassificationReportMutation = trpc.library.classificationMonitor.schedule.useMutation();
  const runGitHubBackupMutation = trpc.library.githubBackups.runNow.useMutation();
  const scheduleGitHubBackupMutation = trpc.library.githubBackups.schedule.useMutation();
  const restoreGitHubBackupMutation = trpc.library.githubBackups.restoreVersion.useMutation();

  const [records, setRecords] = useState<BookRecord[]>(initialLocalRecords);
  const [activeView, setActiveView] = useState<LibraryView>("acervo");
  const [status, setStatus] = useState<RecordStatus>("all");
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [extensionFilter, setExtensionFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [searchSort, setSearchSort] = useState<SearchSort>("title");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [entry, setEntry] = useState<EntryForm>(emptyForm);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [assets, setAssets] = useState<LinkedAsset[]>([]);
  const [metadata, setMetadata] = useState<BookMetadata[]>([]);
  const [readingEvents, setReadingEvents] = useState<ReadingEvent[]>([]);
  const [readingGoals, setReadingGoals] = useState<ReadingGoal[]>([]);
  const [wantToRead, setWantToRead] = useState<WantToReadItem[]>([]);
  const [readingBookUid, setReadingBookUid] = useState("");
  const [isbnEntry, setIsbnEntry] = useState("");
  const [metadataDraft, setMetadataDraft] = useState<BookMetadata | null>(null);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [syncConflict, setSyncConflict] = useState<{ remoteBooks: BookRecord[]; localOnly: BookRecord[] } | null>(null);
  const [localArchive, setLocalArchive] = useState<BookRecord[]>(initialLocalArchive);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [ruleEntry, setRuleEntry] = useState<EditableRule>(emptyRule);
  const [assetBook, setAssetBook] = useState<BookRecord | null>(null);
  const [assetEntry, setAssetEntry] = useState<AssetForm>(emptyAsset);
  const inputRef = useRef<HTMLInputElement>(null);
  const assetFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    if (!isAuthenticated || cloudHydrated || syncConflict || !snapshotQuery.data) return;
    const remoteBooks = snapshotQuery.data.books.map((book) => asBookRecord(book as Record<string, unknown>));
    const remoteRules = snapshotQuery.data.rules.map((rule) => asEditableRule(rule as Record<string, unknown>));
    const remoteAssets = snapshotQuery.data.assets.map((asset) => asLinkedAsset(asset as Record<string, unknown>));
    const remoteMetadata = (snapshotQuery.data.metadata || []).map((item) => asBookMetadata(item as Record<string, unknown>));
    const remoteReadingEvents = (snapshotQuery.data.readingEvents || []).map((item) => asReadingEvent(item as Record<string, unknown>));
    const remoteGoals = (snapshotQuery.data.goals || []).map((item) => asReadingGoal(item as Record<string, unknown>));
    const remoteWantToRead = (snapshotQuery.data.wantToRead || []).map((item) => asWantToReadItem(item as Record<string, unknown>));
    setRules(remoteRules);
    setAssets(remoteAssets);
    setMetadata(remoteMetadata);
    setReadingEvents(remoteReadingEvents);
    setReadingGoals(remoteGoals);
    setWantToRead(remoteWantToRead);
    const localOnly = localOnlyRecords(remoteBooks, records);
    if (remoteBooks.length && localOnly.length) {
      setSyncConflict({ remoteBooks, localOnly });
      return;
    }
    if (remoteBooks.length) {
      setRecords(normalizeLibrary(remoteBooks));
      toast.success("Acervo sincronizado com sua conta.");
    } else if (records.length) {
      syncRemoteBooks(normalizeLibrary(records), "Seu acervo local foi protegido na nuvem.", true);
    }
    setCloudHydrated(true);
  }, [cloud, cloudHydrated, importBooksMutation, isAuthenticated, records, snapshotQuery.data, syncConflict]);

  useEffect(() => {
    if (rulesQuery.data) setRules(rulesQuery.data.map((rule) => asEditableRule(rule as Record<string, unknown>)));
  }, [rulesQuery.data]);

  useEffect(() => {
    if (assetsQuery.data) setAssets(assetsQuery.data.map((asset) => asLinkedAsset(asset as Record<string, unknown>)));
  }, [assetsQuery.data]);

  useEffect(() => {
    if (metadataQuery.data) setMetadata(metadataQuery.data.map((item) => asBookMetadata(item as Record<string, unknown>)));
  }, [metadataQuery.data]);

  useEffect(() => {
    if (readingQuery.data) setReadingEvents(readingQuery.data.map((item) => asReadingEvent(item as Record<string, unknown>)));
  }, [readingQuery.data]);

  useEffect(() => {
    if (readingGoalsQuery.data) setReadingGoals(readingGoalsQuery.data.map((item) => asReadingGoal(item as Record<string, unknown>)));
  }, [readingGoalsQuery.data]);

  useEffect(() => {
    if (wantToReadQuery.data) setWantToRead(wantToReadQuery.data.map((item) => asWantToReadItem(item as Record<string, unknown>)));
  }, [wantToReadQuery.data]);

  const metrics = useMemo(() => ({
    total: records.length,
    review: records.filter((record) => record.warnings.length > 0).length,
    duplicates: records.filter((record) => record.duplicate).length,
    classified: records.filter((record) => record.confidence !== "Revisar" && !record.duplicate).length,
  }), [records]);

  const readingNow = useMemo(() => deriveReadingNow(records, metadata, readingEvents), [metadata, readingEvents, records]);

  const authorOptions = useMemo(() => Array.from(new Set(records.map((record) => record.author).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [records]);
  const collectionOptions = useMemo(() => Array.from(new Set(records.map((record) => record.collection).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [records]);
  const extensionOptions = useMemo(() => Array.from(new Set(records.map((record) => record.extension).filter(Boolean))).sort(), [records]);
  const activeFilterCount = [status !== "all", genreFilter !== "all", authorFilter !== "all", collectionFilter !== "all", mediaFilter !== "all", extensionFilter !== "all", confidenceFilter !== "all", assetFilter !== "all"].filter(Boolean).length;

  const visibleRecords = useMemo(() => {
    const linkedBookUids = new Set(assets.map((asset) => asset.bookUid));
    const filtered = records.filter((record) => {
      const matchesView = activeView !== "revisar" || record.warnings.length > 0;
      const hasAsset = linkedBookUids.has(record.uid);
      const matchesAssets = assetFilter === "all" || (assetFilter === "linked" && hasAsset) || (assetFilter === "unlinked" && !hasAsset);
      return matchesAdvancedFilters(record, { query, status, genre: genreFilter, author: authorFilter, collection: collectionFilter, media: mediaFilter, extension: extensionFilter, confidence: confidenceFilter, assetState: assetFilter }) && matchesAssets && matchesView;
    });
    return filtered.sort((left, right) => {
      if (searchSort === "author") return left.author.localeCompare(right.author, "pt-BR") || left.title.localeCompare(right.title, "pt-BR");
      if (searchSort === "shinko") return left.shinkoId.localeCompare(right.shinkoId, "pt-BR");
      return left.title.localeCompare(right.title, "pt-BR") || left.author.localeCompare(right.author, "pt-BR");
    });
  }, [activeView, assets, assetFilter, authorFilter, collectionFilter, confidenceFilter, extensionFilter, genreFilter, mediaFilter, query, records, searchSort, status]);

  const approvableReviewIds = useMemo(() => visibleRecords.filter((record) => !record.duplicate && record.warnings.length > 0).map((record) => record.uid), [visibleRecords]);
  const selectedApprovals = selectedUids.filter((uid) => approvableReviewIds.includes(uid));
  const allVisibleApprovalsSelected = approvableReviewIds.length > 0 && approvableReviewIds.every((uid) => selectedUids.includes(uid));

  function clearAdvancedFilters() {
    setStatus("all");
    setGenreFilter("all");
    setAuthorFilter("all");
    setCollectionFilter("all");
    setMediaFilter("all");
    setExtensionFilter("all");
    setConfidenceFilter("all");
    setAssetFilter("all");
    setSearchSort("title");
    setQuery("");
  }

  function toggleApproval(uid: string) {
    setSelectedUids((current) => current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]);
  }

  function toggleAllApprovals() {
    setSelectedUids((current) => allVisibleApprovalsSelected ? current.filter((uid) => !approvableReviewIds.includes(uid)) : Array.from(new Set([...current, ...approvableReviewIds])));
  }

  function approveSelected() {
    if (!selectedApprovals.length) {
      toast.message("Selecione ao menos uma sugestão para aprovar.");
      return;
    }
    if (!window.confirm(`Aprovar ${selectedApprovals.length} sugestão${selectedApprovals.length > 1 ? "ões" : ""} selecionada${selectedApprovals.length > 1 ? "s" : ""}? Os registros continuarão editáveis individualmente.`)) return;
    const approved = new Set(selectedApprovals);
    const next = records.map((record) => {
      if (!approved.has(record.uid)) return record;
      return { ...record, warnings: record.warnings.filter((warning) => warning === "Possível duplicidade no acervo."), confidence: record.confidence === "Revisar" ? "Média" : record.confidence };
    });
    setLibrary(next);
    syncRemoteBooks(next);
    setSelectedUids((current) => current.filter((uid) => !approved.has(uid)));
    toast.success(`${selectedApprovals.length} registro${selectedApprovals.length > 1 ? "s foram aprovados" : " foi aprovado"} em lote.`);
  }

  function setLibrary(next: BookRecord[]) {
    setRecords(normalizeLibrary(next));
  }

  function syncRemoteBooks(books: BookRecord[], successMessage?: string, reportImport = false) {
    if (!isAuthenticated) return;
    importBooksMutation.mutate({ books }, {
      onSuccess: (result) => {
        cloud.library.snapshot.invalidate();
        if (reportImport) {
          cloud.library.classificationMonitor.dashboard.invalidate();
          cloud.library.classificationMonitor.history.invalidate();
          const report = result.report as ClassificationReport | null;
          if (report?.exceeded) toast.error(`${report.generalCount} item${report.generalCount === 1 ? "" : "s"} caiu${report.generalCount === 1 ? "" : "ram"} em Literatura Geral. Abra “Classificação” para revisar os padrões.`);
          else if (report) toast.success(`Importação acompanhada: ${report.generalCount} item${report.generalCount === 1 ? "" : "s"} em Literatura Geral.`);
        } else if (successMessage) toast.success(successMessage);
      },
      onError: () => toast.error("A alteração ficou salva neste dispositivo, mas a sincronização falhou."),
    });
  }

  function resolveSyncConflict(action: "merge" | "remote") {
    if (!syncConflict) return;
    if (action === "merge") {
      const merged = normalizeLibrary(mergeByUid(syncConflict.remoteBooks, syncConflict.localOnly));
      setRecords(merged);
      syncRemoteBooks(syncConflict.localOnly, "Registros locais adicionados ao acervo sincronizado.");
    } else {
      const chosen = chooseRemoteCopy(window.localStorage, LOCAL_ARCHIVE_KEY, syncConflict.remoteBooks, syncConflict.localOnly);
      setRecords(normalizeLibrary(chosen.visibleRecords));
      setLocalArchive(normalizeLibrary(chosen.archivedRecords));
      toast.success("Exibindo a cópia da conta. Seus registros locais foram arquivados neste navegador.");
    }
    setSyncConflict(null);
    setCloudHydrated(true);
  }

  function restoreLocalArchive() {
    if (!localArchive.length) return;
    if (!window.confirm(`Adicionar ${localArchive.length} registros locais arquivados ao acervo atual?`)) return;
    const recovered = restoreArchivedCopy(window.localStorage, LOCAL_ARCHIVE_KEY, records);
    setRecords(normalizeLibrary(recovered.mergedRecords));
    syncRemoteBooks(recovered.restoredRecords, "Registros locais arquivados foram adicionados ao acervo sincronizado.");
    setLocalArchive([]);
  }

  function openNewRule() { setRuleEntry({ ...emptyRule, uid: crypto.randomUUID() }); setIsRuleDialogOpen(true); }
  function openRule(rule: EditableRule) { setRuleEntry(rule); setIsRuleDialogOpen(true); }

  function saveRule(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) { startLogin(); return; }
    saveRuleMutation.mutate(ruleEntry, { onSuccess: () => { cloud.library.rules.invalidate(); setIsRuleDialogOpen(false); toast.success("Regra de coleção salva e sincronizada."); }, onError: () => toast.error("Não foi possível salvar esta regra.") });
  }

  function removeRule(uid: string) {
    if (!window.confirm("Remover esta regra personalizada? Os livros já catalogados não serão apagados.")) return;
    removeRuleMutation.mutate({ uid }, { onSuccess: () => { cloud.library.rules.invalidate(); toast.success("Regra removida."); }, onError: () => toast.error("Não foi possível remover a regra.") });
  }

  function openAssetsFor(record: BookRecord) { setAssetBook(record); setAssetEntry(emptyAsset); }

  function saveAsset(event: FormEvent) {
    event.preventDefault();
    if (!assetBook) return;
    if (!isAuthenticated) { startLogin(); return; }
    const asset: LinkedAsset = { uid: crypto.randomUUID(), bookUid: assetBook.uid, ...assetEntry, storageKey: "", storageUrl: "", mimeType: "", byteSize: 0 };
    saveAssetMutation.mutate(asset, { onSuccess: () => { cloud.library.assets.invalidate(); setAssetEntry(emptyAsset); toast.success("Exemplar associado e sincronizado."); }, onError: () => toast.error("Não foi possível associar este exemplar.") });
  }

  function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !assetBook) return;
    if (!isAuthenticated) { startLogin(); return; }
    if (file.size > 9 * 1024 * 1024) { toast.error("O anexo deve ter até 9 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      uploadAssetMutation.mutate({ bookUid: assetBook.uid, label: file.name, fileName: file.name, mimeType: file.type || "application/octet-stream", base64 }, { onSuccess: () => { cloud.library.assets.invalidate(); toast.success("Arquivo digital associado ao livro."); }, onError: () => toast.error("Não foi possível enviar este arquivo.") });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function removeAsset(uid: string) { removeAssetMutation.mutate({ uid }, { onSuccess: () => { cloud.library.assets.invalidate(); toast.success("Associação removida."); }, onError: () => toast.error("Não foi possível remover a associação.") }); }

  function createBackup() {
    if (!isAuthenticated) { startLogin(); return; }
    createBackupMutation.mutate({ label: `Backup Shinko — ${new Date().toLocaleString("pt-BR")}` }, { onSuccess: () => { cloud.library.backups.invalidate(); toast.success("Cópia de segurança criada."); }, onError: () => toast.error("Não foi possível criar a cópia de segurança.") });
  }

  function runGitHubBackup() {
    if (!isAuthenticated) { startLogin(); return; }
    runGitHubBackupMutation.mutate(undefined, { onSuccess: (result) => { cloud.library.githubBackups.settings.invalidate(); toast.success(`Lista enviada ao GitHub: ${result.counts.books} livros.`); }, onError: () => toast.error("Não foi possível enviar a lista ao GitHub.") });
  }

  function scheduleGitHubBackup(enabled: boolean) {
    if (!isAuthenticated) { startLogin(); return; }
    scheduleGitHubBackupMutation.mutate({ enabled }, { onSuccess: () => { cloud.library.githubBackups.settings.invalidate(); toast.success(enabled ? "Backup diário ativado." : "Backup diário pausado."); }, onError: () => toast.error("Não foi possível atualizar o backup diário.") });
  }

  function restoreGitHubBackup(path: string) {
    if (!isAuthenticated) { startLogin(); return; }
    if (!window.confirm("Restaurar esta versão do GitHub? A lista de livros e regras atual será substituída. Metadados, arquivos, diário e planejamento de livros ausentes na versão serão removidos para preservar a integridade.")) return;
    restoreGitHubBackupMutation.mutate({ path }, { onSuccess: (result) => { cloud.library.snapshot.invalidate(); cloud.library.rules.invalidate(); cloud.library.assets.invalidate(); cloud.library.metadata.invalidate(); cloud.library.reading.invalidate(); cloud.library.wantToRead.invalidate(); toast.success(`Versão do GitHub restaurada: ${result.bookCount} livros e ${result.ruleCount} regras.`); }, onError: () => toast.error("Não foi possível restaurar a versão selecionada do GitHub.") });
  }

  function restoreBackup(uid: string) {
    if (!window.confirm("Restaurar esta cópia? O estado atual do acervo sincronizado será substituído.")) return;
    restoreBackupMutation.mutate({ uid }, { onSuccess: (snapshot) => { setRecords(normalizeLibrary(snapshot.books)); setRules(snapshot.rules); setAssets(snapshot.assets); setMetadata(snapshot.metadata || []); setReadingEvents(snapshot.readingEvents || []); setReadingGoals(snapshot.goals || []); setWantToRead(snapshot.wantToRead || []); cloud.library.snapshot.invalidate(); cloud.library.rules.invalidate(); cloud.library.assets.invalidate(); cloud.library.metadata.invalidate(); cloud.library.reading.invalidate(); cloud.library.readingGoals.invalidate(); cloud.library.wantToRead.invalidate(); toast.success("Cópia restaurada com sucesso."); }, onError: () => toast.error("Não foi possível restaurar a cópia selecionada.") });
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const workbook = XLSX.read(loadEvent.target?.result, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
        const imported = rows
          .map((row) => String(row.Name || row.Nome || row.Título || row.Titulo || Object.values(row)[0] || "").trim())
          .filter(Boolean)
          .map((raw) => parseBookWithRules(raw, rules));
        if (!imported.length) throw new Error("Nenhuma linha com nome de livro foi encontrada.");
        const merged = normalizeLibrary([...records, ...imported]);
        setLibrary(merged);
        syncRemoteBooks(imported, undefined, true);
        setActiveView("acervo");
        toast.success(`${imported.length} livros entraram na mesa de catalogação.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível ler esta planilha.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function openNewRecord() {
    setEditingUid(null);
    setEntry(emptyForm);
    setIsbnEntry("");
    setMetadataDraft(null);
    setIsDialogOpen(true);
  }

  function openEditRecord(record: BookRecord) {
    const { uid, shinkoId: _shinkoId, filename: _filename, classification: _classification, confidence: _confidence, warnings: _warnings, duplicate: _duplicate, ...form } = record;
    setEditingUid(uid);
    setEntry({ ...form, uid });
    const savedMetadata = metadata.find((item) => item.bookUid === uid) || null;
    setIsbnEntry(savedMetadata?.isbn || "");
    setMetadataDraft(savedMetadata);
    setIsDialogOpen(true);
  }

  function suggestFromRaw() {
    if (!entry.raw.trim()) {
      toast.message("Informe o nome original do arquivo ou do livro primeiro.");
      return;
    }
    const suggestion = applyEditableRule(parseRawBook(entry.raw, entry.uid || crypto.randomUUID()), rules);
    const { uid, shinkoId: _shinkoId, filename: _filename, classification: _classification, confidence: _confidence, warnings: _warnings, duplicate: _duplicate, ...form } = suggestion;
    setEntry({ ...form, uid });
    toast.success("Sugestão preparada. Ajuste qualquer campo antes de salvar.");
  }

  function lookupIsbnForEntry() {
    if (!isAuthenticated) { startLogin(); return; }
    if (!editingUid) { toast.message("Salve a ficha uma vez e use Editar para associar metadados e capa por ISBN."); return; }
    if (!isbnEntry.trim()) { toast.message("Informe um ISBN-10 ou ISBN-13."); return; }
    lookupIsbnMutation.mutate({ bookUid: editingUid, isbn: isbnEntry }, {
      onSuccess: (found) => {
        const author = found.authors?.[0] ? normalizeAuthor(found.authors[0]) : entry.author;
        setEntry((current) => ({ ...current, raw: current.raw || `${found.title}${author ? ` - ${author}` : ""}`, title: found.title || current.title, author, slug: author ? makeSlug(author) : current.slug }));
        setIsbnEntry(found.isbn);
        setMetadataDraft({ bookUid: editingUid, isbn: found.isbn, subtitle: found.subtitle, publisher: found.publisher, publishedDate: found.publishedDate, pageCount: found.pageCount, summary: found.summary, coverUrl: found.coverUrl, coverStorageKey: found.coverStorageKey, source: found.source, sourceUrl: found.sourceUrl });
        toast.success("Metadados e capa encontrados. Revise os campos e confirme o salvamento.");
      },
      onError: (error) => toast.error(error.message || "Não foi possível consultar esse ISBN."),
    });
  }

  function saveMetadataDraft() {
    if (!metadataDraft || !isAuthenticated) { if (!isAuthenticated) startLogin(); return; }
    saveMetadataMutation.mutate(metadataDraft, { onSuccess: () => { setMetadata((current) => [...current.filter((item) => item.bookUid !== metadataDraft.bookUid), metadataDraft]); cloud.library.metadata.invalidate(); toast.success("Metadados ISBN revisados e salvos."); }, onError: () => toast.error("Não foi possível salvar os metadados ISBN.") });
  }

  function addReadingEvent(bookUid: string, type: ReadingEvent["type"], page: number, progress: number, note: string) {
    if (!isAuthenticated) { startLogin(); return; }
    const event: ReadingEvent = { uid: crypto.randomUUID(), bookUid, type, page, progress, note, occurredAt: Date.now() };
    addReadingMutation.mutate(event, { onSuccess: () => { setReadingEvents((current) => [event, ...current]); cloud.library.reading.invalidate(); toast.success("Histórico de leitura atualizado."); }, onError: () => toast.error("Não foi possível registrar esta leitura.") });
  }

  function addToWantToRead(book: BookRecord) {
    if (!isAuthenticated) { startLogin(); return; }
    if (wantToRead.some((item) => item.bookUid === book.uid)) { setActiveView("quero-ler"); toast.message("Esta obra já está no seu planejamento de leitura."); return; }
    const item: WantToReadItem = { uid: crypto.randomUUID(), bookUid: book.uid, priority: "Média", note: "", position: wantToRead.length };
    saveWantToReadMutation.mutate(item, { onSuccess: () => { setWantToRead((current) => [...current, item].sort((a, b) => a.position - b.position)); cloud.library.wantToRead.invalidate(); cloud.library.snapshot.invalidate(); toast.success("Obra adicionada à lista Quero ler."); }, onError: () => toast.error("Não foi possível incluir esta obra no planejamento.") });
  }

  function saveWantToRead(item: WantToReadItem, priority: WantToReadItem["priority"], note: string) {
    if (!isAuthenticated) { startLogin(); return; }
    const next = { ...item, priority, note: note.trim() };
    saveWantToReadMutation.mutate(next, { onSuccess: () => { setWantToRead((current) => current.map((candidate) => candidate.uid === next.uid ? next : candidate)); cloud.library.wantToRead.invalidate(); cloud.library.snapshot.invalidate(); toast.success("Planejamento de leitura atualizado."); }, onError: () => toast.error("Não foi possível atualizar este planejamento.") });
  }

  function removeFromWantToRead(item: WantToReadItem) {
    if (!window.confirm("Remover esta obra da lista Quero ler?")) return;
    removeWantToReadMutation.mutate({ uid: item.uid }, { onSuccess: () => { setWantToRead((current) => current.filter((candidate) => candidate.uid !== item.uid)); cloud.library.wantToRead.invalidate(); cloud.library.snapshot.invalidate(); toast.success("Obra removida da lista Quero ler."); }, onError: () => toast.error("Não foi possível remover esta obra da lista.") });
  }

  function moveWantToRead(item: WantToReadItem, direction: -1 | 1) {
    const ordered = [...wantToRead].sort((a, b) => a.position - b.position);
    const currentIndex = ordered.findIndex((candidate) => candidate.uid === item.uid);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
    const next = ordered.map((candidate, position) => ({ ...candidate, position }));
    reorderWantToReadMutation.mutate({ uids: next.map((candidate) => candidate.uid) }, { onSuccess: () => { setWantToRead(next); cloud.library.wantToRead.invalidate(); cloud.library.snapshot.invalidate(); }, onError: () => toast.error("Não foi possível reorganizar a lista agora.") });
  }

  function beginPlannedReading(item: WantToReadItem) {
    if (!isAuthenticated) { startLogin(); return; }
    const event: ReadingEvent = { uid: crypto.randomUUID(), bookUid: item.bookUid, type: "started", page: 0, progress: 0, note: "Iniciada a partir da lista Quero ler.", occurredAt: Date.now() };
    beginReadingMutation.mutate({ uid: item.uid, event }, { onSuccess: () => { setWantToRead((current) => current.filter((candidate) => candidate.uid !== item.uid)); setReadingEvents((current) => [event, ...current]); setReadingBookUid(item.bookUid); setActiveView("leitura"); cloud.library.wantToRead.invalidate(); cloud.library.reading.invalidate(); cloud.library.snapshot.invalidate(); toast.success("Leitura iniciada e transferida para o diário."); }, onError: () => toast.error("Não foi possível iniciar esta leitura.") });
  }

  function openReadingFor(bookUid: string) {
    setReadingBookUid(bookUid);
    setActiveView("leitura");
  }

  function saveReadingGoal(period: ReadingGoal["period"], targetBooks: number) {
    if (!isAuthenticated) { startLogin(); return; }
    const periodKey = readingPeriodKeys()[period];
    const existing = readingGoals.find((goal) => goal.period === period && goal.periodKey === periodKey);
    const goal: ReadingGoal = { uid: existing?.uid || crypto.randomUUID(), period, periodKey, targetBooks: Math.max(1, Math.round(targetBooks) || 1) };
    saveReadingGoalMutation.mutate(goal, { onSuccess: () => { setReadingGoals((current) => [...current.filter((item) => !(item.period === goal.period && item.periodKey === goal.periodKey)), goal]); cloud.library.readingGoals.invalidate(); toast.success("Meta de leitura atualizada."); }, onError: () => toast.error("Não foi possível salvar a meta de leitura.") });
  }

  function saveRecord(event: FormEvent) {
    event.preventDefault();
    const saved = recordFromForm({ ...entry, uid: editingUid || entry.uid }, rules);
    if (editingUid) {
      setLibrary(records.map((record) => (record.uid === editingUid ? saved : record)));
      if (isAuthenticated) saveBookMutation.mutate(saved, { onSuccess: () => cloud.library.snapshot.invalidate(), onError: () => toast.error("Registro salvo localmente, mas não sincronizado.") });
      toast.success("Registro atualizado e ID recalculado.");
    } else {
      setLibrary([...records, saved]);
      if (isAuthenticated) saveBookMutation.mutate(saved, { onSuccess: () => cloud.library.snapshot.invalidate(), onError: () => toast.error("Registro salvo localmente, mas não sincronizado.") });
      toast.success("Novo livro adicionado ao acervo.");
    }
    setIsDialogOpen(false);
  }

  function removeRecord() {
    if (!editingUid) return;
    const record = records.find((item) => item.uid === editingUid);
    if (!record || !window.confirm(`Remover “${record.title}” do acervo?`)) return;
    setLibrary(records.filter((item) => item.uid !== editingUid));
    if (isAuthenticated) removeBookMutation.mutate({ uid: editingUid }, { onSuccess: () => cloud.library.snapshot.invalidate(), onError: () => toast.error("O registro foi removido localmente, mas não da nuvem.") });
    setIsDialogOpen(false);
    toast.success("Registro removido do acervo.");
  }

  function exportWorkbook() {
    if (!records.length) {
      toast.message("Importe ou cadastre ao menos um livro antes de exportar.");
      return;
    }
    const acervo = records.map((record) => ({
      "Nome original": record.raw,
      "Título da obra": record.title,
      Autor: record.author,
      "Código de mídia": record.media,
      "Código de gênero": record.genre,
      "Slug": record.slug,
      Volume: record.volume,
      Coleção: record.collection,
      "Código da série": record.seriesCode,
      "Série / fascículo": record.seriesNumber,
      "ID Shinko": record.shinkoId,
      "Nome de arquivo": record.filename,
      "Classificação sugerida": record.classification,
      "Status de revisão": record.warnings.join(" ") || "Pronto",
    }));
    const pendencias = records.filter((record) => record.warnings.length).map((record) => ({
      "ID Shinko": record.shinkoId,
      Título: record.title,
      Autor: record.author,
      Pendência: record.warnings.join(" "),
    }));
    const taxonomy = taxonomyRows.map(([media, genre, category]) => ({ Mídia: media, Gênero: genre, Categoria: category }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(acervo), "Acervo Shinko");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pendencias), "Revisar");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(taxonomy), "Taxonomia");
    XLSX.writeFile(workbook, "biblioteca-shinko-formatada.xlsx");
    toast.success("Excel formatado com três abas foi preparado.");
  }

  function exportReadingWorkbook() {
    const keys = readingPeriodKeys();
    const monthlyTarget = readingGoals.find((goal) => goal.period === "monthly" && goal.periodKey === keys.monthly)?.targetBooks || 0;
    const yearlyTarget = readingGoals.find((goal) => goal.period === "yearly" && goal.periodKey === keys.yearly)?.targetBooks || 0;
    const monthlyCompleted = completedBooksForPeriod(readingEvents, "monthly", keys.monthly);
    const yearlyCompleted = completedBooksForPeriod(readingEvents, "yearly", keys.yearly);
    const byUid = new Map(records.map((record) => [record.uid, record]));
    const diary = [...readingEvents].sort((a, b) => b.occurredAt - a.occurredAt).map((event) => ({ Data: new Date(event.occurredAt).toLocaleString("pt-BR"), Evento: { started: "Início", progress: "Progresso", finished: "Concluído", abandoned: "Pausado", note: "Anotação" }[event.type], Título: byUid.get(event.bookUid)?.title || "Livro removido", Autor: byUid.get(event.bookUid)?.author || "", Página: event.page || "", "Progresso (%)": event.progress, Nota: event.note }));
    const completed = readingEvents.filter((event) => event.type === "finished").map((event) => ({ Concluído_em: new Date(event.occurredAt).toLocaleDateString("pt-BR"), Título: byUid.get(event.bookUid)?.title || "Livro removido", Autor: byUid.get(event.bookUid)?.author || "", "ID Shinko": byUid.get(event.bookUid)?.shinkoId || "" }));
    const summary = [{ Período: `Mês ${keys.monthly}`, "Meta (livros)": monthlyTarget || "Não definida", Concluídos: monthlyCompleted, Saldo: monthlyTarget ? Math.max(0, monthlyTarget - monthlyCompleted) : "" }, { Período: `Ano ${keys.yearly}`, "Meta (livros)": yearlyTarget || "Não definida", Concluídos: yearlyCompleted, Saldo: yearlyTarget ? Math.max(0, yearlyTarget - yearlyCompleted) : "" }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Resumo de metas");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(diary), "Diário de leitura");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(completed), "Obras concluídas");
    XLSX.writeFile(workbook, `diario-leitura-shinko-${keys.yearly}.xlsx`);
    toast.success("Excel do diário de leitura foi preparado.");
  }

  function exportClassificationWorkbook() {
    const localDashboard = calculateClassificationMetrics(records, { count: classificationDashboardQuery.data?.settings.alertThresholdCount || 10, percent: classificationDashboardQuery.data?.settings.alertThresholdPercent || 5 });
    const dashboard = classificationDashboardQuery.data ? classificationDashboardQuery.data as ClassificationDashboard : { ...localDashboard, settings: { uid: "", alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "weekly" as const, reportEnabled: false, scheduleCronTaskUid: "", lastReportAt: null }, latestReport: null };
    const byUid = new Map(records.map((record) => [record.uid, record]));
    const items = dashboard.summary.generalBookUids.map((uid) => byUid.get(uid)).filter((record): record is BookRecord => Boolean(record)).map((record) => ({ "ID Shinko": record.shinkoId, Título: record.title, Autor: record.author || "Autor a confirmar", Coleção: record.collection || "Sem coleção", Arquivo: record.raw, Avisos: record.warnings.join(" ") || "Classificação pendente" }));
    const summary = [{ "Total no acervo": dashboard.totalBooks, "Literatura Geral pendente": dashboard.generalCount, "Percentual (%)": Number((dashboard.generalPercentBasisPoints / 100).toFixed(2)), "Pedem revisão": dashboard.reviewCount, "Limite por quantidade": dashboard.settings.alertThresholdCount, "Limite percentual (%)": dashboard.settings.alertThresholdPercent, "Alerta ativo": dashboard.exceeded ? "Sim" : "Não" }];
    const groups = (items: { label: string; count: number }[], type: string) => items.map((item) => ({ Grupo: type, Padrão: item.label, Ocorrências: item.count }));
    const history = (classificationHistoryQuery.data || []).map((report) => ({ Gerado_em: new Date(report.periodEnd).toLocaleString("pt-BR"), Origem: { import: "Importação", manual: "Manual", scheduled: "Agendado" }[report.source], "Literatura Geral": report.generalCount, "Percentual (%)": Number((report.generalPercentBasisPoints / 100).toFixed(2)), Alerta: report.exceeded ? "Sim" : "Não" }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Resumo");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(items), "Literatura Geral");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(groups(dashboard.summary.topAuthors, "Autor")), "Autores recorrentes");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(groups(dashboard.summary.topTerms, "Termo")), "Termos recorrentes");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(groups(dashboard.summary.topCollections, "Coleção")), "Coleções recorrentes");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(history), "Histórico");
    XLSX.writeFile(workbook, `relatorio-classificacao-shinko-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Relatório de classificação em Excel foi preparado.");
  }

  function saveClassificationSettings(settings: Pick<ClassificationMonitorSettings, "alertThresholdCount" | "alertThresholdPercent" | "reportFrequency">) {
    if (!isAuthenticated) { startLogin(); return; }
    saveClassificationSettingsMutation.mutate(settings, { onSuccess: () => { cloud.library.classificationMonitor.dashboard.invalidate(); toast.success("Limites e frequência do relatório atualizados."); }, onError: () => toast.error("Não foi possível salvar essas preferências.") });
  }

  function runClassificationReport() {
    if (!isAuthenticated) { startLogin(); return; }
    runClassificationReportMutation.mutate(undefined, { onSuccess: (report) => { cloud.library.classificationMonitor.dashboard.invalidate(); cloud.library.classificationMonitor.history.invalidate(); toast.success(`Relatório preparado: ${report.generalCount} item${report.generalCount === 1 ? "" : "s"} em Literatura Geral.`); }, onError: () => toast.error("Não foi possível gerar o relatório agora.") });
  }

  function setClassificationSchedule(enabled: boolean) {
    if (!isAuthenticated) { startLogin(); return; }
    scheduleClassificationReportMutation.mutate({ enabled }, { onSuccess: () => { cloud.library.classificationMonitor.dashboard.invalidate(); toast.success(enabled ? "Relatório periódico ativado." : "Relatório periódico pausado."); }, onError: (error) => toast.error(error.message || "Publique o app antes de ativar o relatório periódico.") });
  }

  function clearLibrary() {
    if (!records.length || !window.confirm("Limpar todos os registros salvos neste navegador? Esta ação não afeta sua planilha original.")) return;
    setRecords([]);
    toast.success("A mesa de catalogação foi limpa.");
  }

  return (
    <div className="min-h-screen bg-[#f5f0e6] text-[#1d2a25]">
      <input ref={inputRef} onChange={handleImport} className="hidden" type="file" accept=".xlsx,.xls,.csv" />
      <input ref={assetFileRef} onChange={uploadAsset} className="hidden" type="file" accept=".epub,.pdf,.mobi,.cbz,.zip,.txt" />
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-lockup">
            <img src="/manus-storage/shinko-mark_720fa080.png" alt="Símbolo Biblioteca Shinko" className="brand-mark" />
            <div>
              <p className="eyebrow text-[#b84432]">Shinko Toshokan</p>
              <p className="brand-name">Biblioteca<br />Shinko</p>
            </div>
          </div>

          <nav className="side-nav" aria-label="Navegação da biblioteca">
            <button className={activeView === "acervo" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("acervo"); setStatus("all"); }}>
              <Library size={18} /> <span>Acervo</span><b>{metrics.total}</b>
            </button>
            <button className={activeView === "revisar" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("revisar"); setStatus("review"); }}>
              <AlertTriangle size={18} /> <span>Revisar</span><b>{metrics.review}</b>
            </button>
            <button className={activeView === "taxonomia" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("taxonomia")}>
              <FolderArchive size={18} /> <span>Taxonomia</span><b>18</b>
            </button>
            <button className={activeView === "regras" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("regras")}>
              <Settings2 size={18} /> <span>Regras</span><b>{rules.length}</b>
            </button>
            <button className={activeView === "classificacao" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("classificacao")}>
              <Sparkles size={18} /> <span>Classificação</span><b>{classificationDashboardQuery.data?.generalCount || records.filter((record) => record.media === "0L" && record.genre === "60" && record.confidence === "Revisar").length}</b>
            </button>
            <button className={activeView === "leitura" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("leitura")}>
              <BookOpen size={18} /> <span>Leitura</span><b>{readingEvents.length}</b>
            </button>
            <button className={activeView === "quero-ler" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("quero-ler")}>
              <BookMarked size={18} /> <span>Quero ler</span><b>{wantToRead.length}</b>
            </button>
            <button className={activeView === "backup" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("backup")}>
              <ShieldCheck size={18} /> <span>Backup</span><b>{backupsQuery.data?.length || 0}</b>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-note">
              <ShieldCheck size={17} />
              <p><strong>{isAuthenticated ? "Acervo sincronizado." : "Modo local ativo."}</strong><br />{isAuthenticated ? "Regras, vínculos e backups ficam protegidos na sua conta." : "Entre para proteger o acervo e acessar em outros dispositivos."}</p>
            </div>
            {localArchive.length > 0 && <button onClick={restoreLocalArchive} className="quiet-button">Adicionar {localArchive.length} registros arquivados</button>}
            {isAuthenticated ? <button onClick={() => logout()} className="quiet-button">Sair da conta</button> : <button onClick={startLogin} className="quiet-button">Entrar e sincronizar</button>}
          </div>
        </aside>

        <main className="main-board">
          <header className="topbar">
            <div>
              <p className="eyebrow">Mesa de catalogação</p>
              <p className="topbar-status"><span /> {loading ? "Conectando à conta" : isAuthenticated ? `Sincronizado · ${user?.name || "sua conta"}` : "Pronta para organizar localmente"}</p>
            </div>
            <div className="topbar-actions">
              {!isAuthenticated && <button onClick={startLogin} className="button button-quiet"><ShieldCheck size={17} /> Sincronizar</button>}
              <button onClick={() => inputRef.current?.click()} className="button button-quiet"><Upload size={17} /> Importar</button>
              <button onClick={openNewRecord} className="button button-primary"><Plus size={18} /> Novo livro</button>
            </div>
          </header>

          <section className="hero-panel">
            <div className="hero-index" aria-hidden="true"><span>ARQ. 001</span><b>ST</b><span>MESA</span></div>
            <img className="hero-image" src="/manus-storage/shinko-hero-catalog_830fb234.jpg" alt="Mesa de catálogo com livros e fichas de classificação" />
            <div className="hero-copy">
              <p className="eyebrow text-[#b84432]">Organização com critério</p>
              <h1>Uma lista de arquivos<br /><em>torna-se um acervo.</em></h1>
              <p>Importe a sua planilha, confirme as sugestões e exporte cada registro com ID Shinko, autor padronizado e nome de arquivo pronto.</p>
              <div className="hero-actions">
                <button onClick={() => inputRef.current?.click()} className="button button-primary"><FileSpreadsheet size={18} /> Ler planilha</button>
                <button onClick={() => setActiveView("taxonomia")} className="text-link">Consultar taxonomia <ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="catalogue-stamp">
              <span>Id Shinko</span>
              <strong>ST.0L.55</strong>
              <i>ficha de classificação</i>
            </div>
          </section>

          <section className="metrics-strip" aria-label="Resumo do acervo">
            <Metric code="REG" icon={<BookOpen size={18} />} label="No acervo" value={metrics.total} note={isAuthenticated ? "registros sincronizados" : "registros locais"} />
            <Metric code="IDX" icon={<Sparkles size={18} />} label="Classificados" value={metrics.classified} note="com sugestão sólida" />
            <Metric code="REV" icon={<AlertTriangle size={18} />} label="Pedem revisão" value={metrics.review} note="autor, gênero ou volume" accent />
            <Metric code="DUP" icon={<MoreHorizontal size={18} />} label="Duplicidades" value={metrics.duplicates} note="título ou ID coincidente" />
          </section>

          {activeView === "taxonomia" ? (
            <TaxonomyView onBack={() => setActiveView("acervo")} />
          ) : activeView === "regras" ? (
            <RulesView rules={rules} onNew={openNewRule} onEdit={openRule} onRemove={removeRule} />
          ) : activeView === "classificacao" ? (
            <ClassificationMonitorView dashboard={classificationDashboardQuery.data as ClassificationDashboard | undefined} history={(classificationHistoryQuery.data || []) as ClassificationReport[]} isAuthenticated={isAuthenticated} isBusy={saveClassificationSettingsMutation.isPending || runClassificationReportMutation.isPending || scheduleClassificationReportMutation.isPending} onLogin={startLogin} onSaveSettings={saveClassificationSettings} onRunNow={runClassificationReport} onSchedule={setClassificationSchedule} onExport={exportClassificationWorkbook} />
          ) : activeView === "leitura" ? (
            <><ReadingGoalsPanel goals={readingGoals} events={readingEvents} isAuthenticated={isAuthenticated} onSaveGoal={saveReadingGoal} onExport={exportReadingWorkbook} isSaving={saveReadingGoalMutation.isPending} /><ReadingView records={records} metadata={metadata} events={readingEvents} selectedBookUid={readingBookUid} isAuthenticated={isAuthenticated} onAdd={addReadingEvent} onLogin={startLogin} isSaving={addReadingMutation.isPending} /></>
          ) : activeView === "quero-ler" ? (
            <WantToReadView items={wantToRead} records={records} metadata={metadata} isAuthenticated={isAuthenticated} onLogin={startLogin} onSave={saveWantToRead} onRemove={removeFromWantToRead} onMove={moveWantToRead} onBegin={beginPlannedReading} isBusy={saveWantToReadMutation.isPending || removeWantToReadMutation.isPending || reorderWantToReadMutation.isPending || beginReadingMutation.isPending} />
          ) : activeView === "backup" ? (
            <BackupView backups={backupsQuery.data || []} githubSettings={githubBackupSettingsQuery.data} githubVersions={githubBackupVersionsQuery.data || []} isLoadingGitHubVersions={githubBackupVersionsQuery.isLoading} isAuthenticated={isAuthenticated} isCreating={createBackupMutation.isPending} isGitHubBusy={runGitHubBackupMutation.isPending || scheduleGitHubBackupMutation.isPending || restoreGitHubBackupMutation.isPending} onCreate={createBackup} onRestore={restoreBackup} onRunGitHub={runGitHubBackup} onScheduleGitHub={scheduleGitHubBackup} onRestoreGitHub={restoreGitHubBackup} onLogin={startLogin} />
          ) : (
            <section className="records-section">
              {activeView === "acervo" && <ReadingNowShelf items={readingNow} onOpenReading={openReadingFor} />}
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{activeView === "revisar" ? "Fila de conferência" : "Acervo em construção"}</p>
                  <h2>{activeView === "revisar" ? "Registros que precisam da sua leitura" : "Cada livro, no seu devido lugar"}</h2>
                </div>
                <button onClick={exportWorkbook} className="button button-dark"><Download size={17} /> Exportar Excel</button>
              </div>

              <div className="record-toolbar">
                <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar título, autor, ID ou categoria" /></label>
                <button className={advancedOpen ? "filter-trigger active" : "filter-trigger"} onClick={() => setAdvancedOpen(!advancedOpen)}><ListFilter size={17} /> Busca avançada {activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
                <span className="result-count">{visibleRecords.length} {visibleRecords.length === 1 ? "registro" : "registros"}</span>
              </div>

              {advancedOpen && <div className="advanced-filters">
                <div className="advanced-heading"><div><span>FILTROS COMBINÁVEIS</span><p>Refine o acervo por classificação, autoria, coleção, qualidade do catálogo e disponibilidade de exemplares.</p></div><button type="button" onClick={clearAdvancedFilters} className="clear-filters">Limpar filtros</button></div>
                <div className="advanced-grid">
                  <label><span>Gênero</span><select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)}><option value="all">Todos os gêneros</option>{genreOptions.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.label}</option>)}</select></label>
                  <label><span>Autor</span><select value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}><option value="all">Todos os autores</option>{authorOptions.map((author) => <option key={author} value={author}>{author}</option>)}</select></label>
                  <label><span>Coleção</span><select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}><option value="all">Todas as coleções</option>{collectionOptions.map((collection) => <option key={collection} value={collection}>{collection}</option>)}</select></label>
                  <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as RecordStatus)}><option value="all">Todos os estados</option><option value="ready">Prontos</option><option value="review">Precisam de revisão</option><option value="duplicate">Duplicidades</option></select></label>
                  <label><span>Mídia</span><select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value)}><option value="all">Todas as mídias</option>{mediaOptions.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.label}</option>)}</select></label>
                  <label><span>Extensão</span><select value={extensionFilter} onChange={(event) => setExtensionFilter(event.target.value)}><option value="all">Todas as extensões</option>{extensionOptions.map((extension) => <option key={extension} value={extension}>.{extension}</option>)}</select></label>
                  <label><span>Confiança da classificação</span><select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value)}><option value="all">Todos os níveis</option><option value="Alta">Alta</option><option value="Média">Média</option><option value="Revisar">A revisar</option></select></label>
                  <label><span>Exemplares vinculados</span><select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}><option value="all">Com ou sem vínculo</option><option value="linked">Com exemplar, link ou arquivo</option><option value="unlinked">Sem exemplar, link ou arquivo</option></select></label>
                  <label><span>Ordenar resultados</span><select value={searchSort} onChange={(event) => setSearchSort(event.target.value as SearchSort)}><option value="title">Título (A–Z)</option><option value="author">Autor (A–Z)</option><option value="shinko">ID Shinko</option></select></label>
                </div>
                {activeFilterCount > 0 && <div className="active-filter-note"><span>FILTRANDO</span><code>{activeFilterCount} critério{activeFilterCount > 1 ? "s" : ""} ativo{activeFilterCount > 1 ? "s" : ""}</code></div>}
              </div>}

              {visibleRecords.length ? (
                <>
                {activeView === "revisar" && <div className="batch-review-bar"><div><span>REVISÃO EM LOTE</span><p>{approvableReviewIds.length} registros elegíveis neste filtro. Duplicidades permanecem para conferência individual.</p></div><div><code>{selectedApprovals.length} selecionado{selectedApprovals.length === 1 ? "" : "s"}</code><button onClick={approveSelected} className="button button-primary" disabled={!selectedApprovals.length}><CheckCircle2 size={17} /> Aprovar selecionados</button></div></div>}
                <div className="records-table-wrap">
                  <table className="records-table">
                    <thead><tr>{activeView === "revisar" && <th className="selection-head"><input type="checkbox" checked={allVisibleApprovalsSelected} onChange={toggleAllApprovals} disabled={!approvableReviewIds.length} aria-label="Selecionar todos os registros elegíveis" /></th>}<th>Obra e autoria</th><th>Classificação</th><th>ID Shinko</th><th>Arquivo sugerido</th><th aria-label="Editar" /></tr></thead>
                    <tbody>
                      {visibleRecords.map((record, index) => (
                        <tr key={record.uid} style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
                          {activeView === "revisar" && <td className="selection-cell">{record.duplicate ? <span title="Duplicidade precisa de conferência individual">—</span> : <input type="checkbox" checked={selectedUids.includes(record.uid)} onChange={() => toggleApproval(record.uid)} aria-label={`Selecionar ${record.title}`} />}</td>}
                          <td><div className="title-cell">{metadata.find((item) => item.bookUid === record.uid)?.coverUrl && <img className="record-cover" src={metadata.find((item) => item.bookUid === record.uid)?.coverUrl} alt={`Capa de ${record.title}`} />}<strong>{record.title}</strong><span>{record.author || "Autor a confirmar"}</span>{record.collection && <div className="series-meta"><code>{record.collection}</code>{record.seriesCode && <small>{record.seriesCode}{record.seriesNumber ? ` · ${record.seriesNumber}` : ""}</small>}</div>}</div></td>
                          <td><div className="classification-cell"><span className={`confidence ${record.confidence === "Alta" ? "high" : record.confidence === "Média" ? "medium" : "review"}`}>{record.confidence === "Revisar" ? "Revisar" : "Sugestão"}</span><small>{record.media}.{record.genre} · {record.classification}</small>{record.warnings.length > 0 && <span className="warning-line"><AlertTriangle size={13} /> {record.warnings[0]}</span>}</div></td>
                          <td><code>{record.shinkoId}</code></td>
                          <td><button onClick={() => { navigator.clipboard.writeText(record.filename); toast.success("Nome de arquivo copiado."); }} className="filename-button" title="Copiar nome de arquivo">{record.filename}</button></td>
                          <td className="row-actions"><button onClick={() => addToWantToRead(record)} className="row-action" aria-label={`Adicionar ${record.title} à lista Quero ler`} title={wantToRead.some((item) => item.bookUid === record.uid) ? "Já está em Quero ler" : "Adicionar à lista Quero ler"} disabled={wantToRead.some((item) => item.bookUid === record.uid)}><BookMarked size={16} /></button><button onClick={() => openAssetsFor(record)} className="row-action" aria-label={`Exemplares de ${record.title}`} title="Vincular exemplar"><FolderArchive size={16} /><small>{assets.filter((asset) => asset.bookUid === record.uid).length}</small></button><button onClick={() => openEditRecord(record)} className="row-action" aria-label={`Editar ${record.title}`} title="Editar ficha"><Settings2 size={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              ) : (
                <EmptyState view={activeView} hasRecords={records.length > 0} onImport={() => inputRef.current?.click()} onCreate={openNewRecord} />
              )}
            </section>
          )}
        </main>
      </div>

      {isDialogOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setIsDialogOpen(false)}>
          <form className="record-dialog" onSubmit={saveRecord} onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-topline"><span>{editingUid ? "FICHA EM REVISÃO" : "NOVA FICHA"}</span><button type="button" onClick={() => setIsDialogOpen(false)} aria-label="Fechar"><X size={20} /></button></div>
            <div className="dialog-heading"><h2>{editingUid ? "Ajustar registro" : "Adicionar ao acervo"}</h2><p>As sugestões são apenas um ponto de partida. Você confirma a versão que vale.</p></div>
            <label className="field full"><span>Nome original do arquivo ou livro</span><div className="raw-field"><input value={entry.raw} onChange={(event) => setEntry({ ...entry, raw: event.target.value })} placeholder="Patrística Vol. 10 - Confissões - Santo Agostinho" /><button type="button" onClick={suggestFromRaw}>Sugerir</button></div></label>
            <label className="field full"><span>ISBN e metadados automáticos</span><div className="raw-field"><input value={isbnEntry} onChange={(event) => setIsbnEntry(event.target.value)} placeholder="ISBN-10 ou ISBN-13" inputMode="numeric" /><button type="button" onClick={lookupIsbnForEntry} disabled={lookupIsbnMutation.isPending}>{lookupIsbnMutation.isPending ? "Consultando" : "Preencher ISBN"}</button></div><small className="field-note">{editingUid ? "Busca título, autores, editora, data, páginas, assuntos e capa; revise os campos e salve a ficha." : "Salve a ficha uma vez para associar metadados e capa por ISBN."}</small></label>
            {metadataDraft && <section className="isbn-metadata-review"><div className="isbn-review-heading"><div><span>METADADOS ISBN</span><strong>Revise antes de salvar</strong></div>{metadataDraft.coverUrl && <img src={metadataDraft.coverUrl} alt={`Capa retornada para ${entry.title || "a obra"}`} />}</div><div className="form-grid"><label className="field"><span>Editora</span><input value={metadataDraft.publisher} onChange={(event) => setMetadataDraft({ ...metadataDraft, publisher: event.target.value })} /></label><label className="field"><span>Data de publicação</span><input value={metadataDraft.publishedDate} onChange={(event) => setMetadataDraft({ ...metadataDraft, publishedDate: event.target.value })} /></label><label className="field"><span>Número de páginas</span><input type="number" min="0" value={metadataDraft.pageCount} onChange={(event) => setMetadataDraft({ ...metadataDraft, pageCount: Math.max(0, Number(event.target.value) || 0) })} /></label><label className="field"><span>Subtítulo</span><input value={metadataDraft.subtitle} onChange={(event) => setMetadataDraft({ ...metadataDraft, subtitle: event.target.value })} /></label><label className="field full"><span>Resumo / assuntos</span><textarea rows={3} value={metadataDraft.summary} onChange={(event) => setMetadataDraft({ ...metadataDraft, summary: event.target.value })} /></label></div><div className="isbn-review-footer"><a href={metadataDraft.sourceUrl} target="_blank" rel="noreferrer" className="text-link">Ver fonte {metadataDraft.source}</a><button type="button" onClick={saveMetadataDraft} className="button button-dark" disabled={saveMetadataMutation.isPending}>{saveMetadataMutation.isPending ? "Salvando" : "Salvar metadados ISBN"}</button></div></section>}
            <div className="form-grid">
              <label className="field full"><span>Título da obra</span><input required value={entry.title} onChange={(event) => setEntry({ ...entry, title: event.target.value })} /></label>
              <label className="field full"><span>Autor (SOBRENOME, Nome)</span><input value={entry.author} onChange={(event) => setEntry({ ...entry, author: event.target.value, slug: makeSlug(event.target.value) })} placeholder="AGOSTINHO, Santo" /></label>
              <label className="field"><span>Mídia</span><select value={entry.media} onChange={(event) => setEntry({ ...entry, media: event.target.value })}>{mediaOptions.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.label}</option>)}</select></label>
              <label className="field"><span>Gênero</span><select value={entry.genre} onChange={(event) => setEntry({ ...entry, genre: event.target.value })}>{genreOptions.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.label}</option>)}</select></label>
              <label className="field"><span>Slug</span><input maxLength={4} value={entry.slug} onChange={(event) => setEntry({ ...entry, slug: event.target.value.toUpperCase() })} /></label>
              <label className="field"><span>Volume</span><input maxLength={2} value={entry.volume} onChange={(event) => setEntry({ ...entry, volume: event.target.value.replace(/\D/g, "").slice(0, 2) || "00" })} /></label>
              <label className="field"><span>Extensão</span><select value={entry.extension} onChange={(event) => setEntry({ ...entry, extension: event.target.value })}><option value="epub">.epub</option><option value="pdf">.pdf</option><option value="cbz">.cbz</option><option value="mobi">.mobi</option></select></label>
              <label className="field"><span>Coleção</span><input value={entry.collection} onChange={(event) => setEntry({ ...entry, collection: event.target.value })} placeholder="Patrística ou Perry Rhodan" /></label>
              <label className="field"><span>Código da série</span><input value={entry.seriesCode} onChange={(event) => setEntry({ ...entry, seriesCode: event.target.value.toUpperCase() })} placeholder="PATR ou PR1825" /></label>
              <label className="field"><span>Série / fascículo</span><input value={entry.seriesNumber} onChange={(event) => setEntry({ ...entry, seriesNumber: event.target.value })} placeholder="Vol. 10 ou Edição 1825" /></label>
              <div className="generated-preview"><span>ID calculado</span><code>{generatedFields(entry).shinkoId}</code></div>
            </div>
            <div className="dialog-actions">{editingUid ? <button type="button" className="delete-button" onClick={removeRecord}>Remover</button> : <span />}<button type="submit" className="button button-primary"><CheckCircle2 size={18} /> {editingUid ? "Salvar ficha" : "Adicionar livro"}</button></div>
          </form>
        </div>
      )}

      {assetBook && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setAssetBook(null)}>
        <form className="record-dialog asset-dialog" onSubmit={saveAsset} onMouseDown={(event) => event.stopPropagation()}>
          <div className="dialog-topline"><span>EXEMPLARES ASSOCIADOS</span><button type="button" onClick={() => setAssetBook(null)} aria-label="Fechar"><X size={20} /></button></div>
          <div className="dialog-heading"><h2>{assetBook.title}</h2><p>Registre a posição de um exemplar físico, guarde um link de leitura ou envie um arquivo digital de até 9 MB.</p></div>
          <div className="asset-list">{assets.filter((asset) => asset.bookUid === assetBook.uid).length ? assets.filter((asset) => asset.bookUid === assetBook.uid).map((asset) => <div className="asset-row" key={asset.uid}><div><code>{asset.kind === "physical" ? "FÍSICO" : asset.kind === "digital-file" ? "ARQUIVO" : "LINK"}</code><strong>{asset.label}</strong><span>{asset.location || asset.sourceUrl || asset.storageUrl}</span></div><div className="asset-row-actions">{(asset.sourceUrl || asset.storageUrl) && <a href={asset.sourceUrl || asset.storageUrl} target="_blank" rel="noreferrer" className="text-link">Abrir</a>}<button type="button" className="delete-button" onClick={() => removeAsset(asset.uid)}>Remover</button></div></div>) : <p className="asset-empty">Ainda não há exemplares associados a esta ficha.</p>}</div>
          <div className="asset-upload"><div><span>ARQUIVO DIGITAL</span><p>O arquivo será armazenado junto do acervo sincronizado.</p></div><button type="button" className="button button-dark" onClick={() => assetFileRef.current?.click()} disabled={uploadAssetMutation.isPending}><Upload size={17} /> {uploadAssetMutation.isPending ? "Enviando" : "Enviar arquivo"}</button></div>
          <div className="dialog-heading compact"><h3>Associar exemplar ou link</h3><p>Use a localização para estante, caixa, dispositivo ou caminho local; use o link para uma fonte digital.</p></div>
          <div className="form-grid"><label className="field"><span>Tipo</span><select value={assetEntry.kind} onChange={(event) => setAssetEntry({ ...assetEntry, kind: event.target.value as AssetForm["kind"] })}><option value="physical">Exemplar físico</option><option value="digital-link">Link digital</option></select></label><label className="field"><span>Identificação</span><input required value={assetEntry.label} onChange={(event) => setAssetEntry({ ...assetEntry, label: event.target.value })} placeholder="Capa dura, Kindle ou acervo pessoal" /></label><label className="field full"><span>Localização {assetEntry.kind === "physical" ? "(obrigatória)" : "(opcional)"}</span><input required={assetEntry.kind === "physical"} value={assetEntry.location} onChange={(event) => setAssetEntry({ ...assetEntry, location: event.target.value })} placeholder="Estante A · prateleira 3, ou caminho local" /></label><label className="field full"><span>Link digital {assetEntry.kind === "digital-link" ? "(obrigatório)" : "(opcional)"}</span><input required={assetEntry.kind === "digital-link"} type="url" value={assetEntry.sourceUrl} onChange={(event) => setAssetEntry({ ...assetEntry, sourceUrl: event.target.value })} placeholder="https://..." /></label></div>
          <div className="dialog-actions"><span /><button type="submit" className="button button-primary"><CheckCircle2 size={18} /> Associar exemplar</button></div>
        </form>
      </div>}

      {isRuleDialogOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setIsRuleDialogOpen(false)}>
        <form className="record-dialog" onSubmit={saveRule} onMouseDown={(event) => event.stopPropagation()}>
          <div className="dialog-topline"><span>REGRA PERSONALIZADA</span><button type="button" onClick={() => setIsRuleDialogOpen(false)} aria-label="Fechar"><X size={20} /></button></div>
          <div className="dialog-heading"><h2>Como reconhecer esta coleção?</h2><p>A expressão é procurada no nome original; quando encontrada, o app aplica coleção, série, mídia, gênero e autor padrão.</p></div>
          <div className="form-grid"><label className="field full"><span>Nome interno da regra</span><input required value={ruleEntry.name} onChange={(event) => setRuleEntry({ ...ruleEntry, name: event.target.value })} placeholder="Ex.: Série Duna" /></label><label className="field full"><span>Texto para reconhecer</span><input required value={ruleEntry.matcher} onChange={(event) => setRuleEntry({ ...ruleEntry, matcher: event.target.value })} placeholder="Ex.: Duna" /></label><label className="field"><span>Coleção</span><input required value={ruleEntry.collection} onChange={(event) => setRuleEntry({ ...ruleEntry, collection: event.target.value })} /></label><label className="field"><span>Código da série</span><input value={ruleEntry.seriesCode} onChange={(event) => setRuleEntry({ ...ruleEntry, seriesCode: event.target.value.toUpperCase() })} placeholder="DUNA" /></label><label className="field"><span>Mídia</span><select value={ruleEntry.media} onChange={(event) => setRuleEntry({ ...ruleEntry, media: event.target.value })}>{mediaOptions.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.label}</option>)}</select></label><label className="field"><span>Gênero</span><select value={ruleEntry.genre} onChange={(event) => setRuleEntry({ ...ruleEntry, genre: event.target.value })}>{genreOptions.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.label}</option>)}</select></label><label className="field full"><span>Autor padrão (opcional)</span><input value={ruleEntry.defaultAuthor} onChange={(event) => setRuleEntry({ ...ruleEntry, defaultAuthor: event.target.value })} placeholder="HERBERT, Frank" /></label><label className="switch-field"><input type="checkbox" checked={ruleEntry.active} onChange={(event) => setRuleEntry({ ...ruleEntry, active: event.target.checked })} /> <span>Regra ativa para novas importações</span></label></div>
          <div className="dialog-actions"><span /><button type="submit" className="button button-primary" disabled={saveRuleMutation.isPending}><CheckCircle2 size={18} /> Salvar regra</button></div>
        </form>
      </div>}

      {syncConflict && <div className="dialog-backdrop" role="presentation">
        <div className="record-dialog sync-conflict-dialog">
          <div className="dialog-topline"><span>ACERVOS ENCONTRADOS</span><ShieldCheck size={19} /></div>
          <div className="dialog-heading"><h2>Escolha como unir seus registros.</h2><p>Há {syncConflict.remoteBooks.length} livros já protegidos na conta e {syncConflict.localOnly.length} registros apenas neste navegador. Nenhuma opção apaga sua planilha original.</p></div>
          <div className="sync-choice-grid"><button onClick={() => resolveSyncConflict("merge")} className="sync-choice"><strong>Unir acervos</strong><span>Adiciona os registros locais que ainda não existem na conta e mantém os dados já sincronizados.</span></button><button onClick={() => resolveSyncConflict("remote")} className="sync-choice"><strong>Usar a cópia da conta</strong><span>Mostra agora o acervo remoto. Os registros locais permanecem neste navegador até você escolher limpá-los.</span></button></div>
        </div>
      </div>}
    </div>
  );
}

function Metric({ code, icon, label, value, note, accent = false }: { code: string; icon: React.ReactNode; label: string; value: number; note: string; accent?: boolean }) {
  return <div className={accent ? "metric-card accent" : "metric-card"}><div className="metric-index"><b>{code}</b>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function EmptyState({ view, hasRecords, onImport, onCreate }: { view: LibraryView; hasRecords: boolean; onImport: () => void; onCreate: () => void }) {
  const isReview = view === "revisar" && hasRecords;
  return <div className="empty-state"><img src="/manus-storage/shinko-empty-shelf_7d95a05a.jpg" alt="Estante de catálogo minimalista" /><div><p className="eyebrow">{isReview ? "Tudo em ordem" : "A primeira ficha"}</p><h3>{isReview ? "Nenhuma pendência neste filtro." : "O acervo está pronto para receber seus livros."}</h3><p>{isReview ? "Ajuste o filtro ou volte ao acervo para consultar os registros já processados." : "Use a planilha original para processar vários títulos de uma vez, ou registre um livro manualmente."}</p><div className="empty-actions">{!isReview && <button onClick={onImport} className="button button-primary"><Upload size={17} /> Importar planilha</button>}<button onClick={onCreate} className="button button-quiet"><Plus size={17} /> Novo livro</button></div></div></div>;
}

function TaxonomyView({ onBack }: { onBack: () => void }) {
  return <section className="taxonomy-view"><div className="taxonomy-cover"><img src="/manus-storage/shinko-taxonomy-banner_1f5e6422.jpg" alt="Fichas e divisórias de catalogação organizadas" /><div><p className="eyebrow text-[#b84432]">Mapa de classificação</p><h2>A taxonomia é a espinha do acervo.</h2><p>Os códigos abaixo alimentam o ID Shinko e organizam os arquivos por mídia, gênero e autor.</p><button onClick={onBack} className="button button-dark">Voltar ao acervo <ArrowUpRight size={17} /></button></div></div><div className="taxonomy-list"><div className="taxonomy-header"><span>Mídia</span><span>Gênero</span><span>Aplicação</span></div>{taxonomyRows.map(([media, genre, category]) => <div className="taxonomy-row" key={`${media}-${genre}`}><code>{media}</code><code>{genre}</code><span>{category}</span></div>)}</div><div className="taxonomy-aside"><img src="/manus-storage/shinko-drawer-portrait_0aa77585.jpg" alt="Gaveta de fichas catalográficas" /><div><p className="eyebrow">Regra de formação</p><code>ST.[Mídia].[Gênero].[Slug]-[Vol]</code><p>O app preenche essa estrutura e destaca conflitos de IDs ou classificações para sua conferência.</p></div></div></section>;
}

function RulesView({ rules, onNew, onEdit, onRemove }: { rules: EditableRule[]; onNew: () => void; onEdit: (rule: EditableRule) => void; onRemove: (uid: string) => void }) {
  return <section className="management-view"><div className="management-heading"><div><p className="eyebrow">Regras de catalogação</p><h2>O acervo aprende o seu modo de classificar.</h2><p>Crie regras a partir do texto que aparece no nome do arquivo. Elas são aplicadas às próximas importações e ficam sincronizadas com sua conta.</p></div><button onClick={onNew} className="button button-primary"><Plus size={18} /> Nova regra</button></div><div className="rule-register">{rules.length ? rules.map((rule) => <article className="rule-card" key={rule.uid}><div className="rule-code"><code>{rule.active ? "ATIVA" : "PAUSADA"}</code><span>{rule.matcher}</span></div><div><h3>{rule.name}</h3><p>{rule.collection} · {rule.seriesCode || "sem código de série"}</p><small>{rule.media}.{rule.genre}{rule.defaultAuthor ? ` · ${rule.defaultAuthor}` : ""}</small></div><div className="rule-actions"><button onClick={() => onEdit(rule)} className="button button-quiet">Editar</button><button onClick={() => onRemove(rule.uid)} className="delete-button">Remover</button></div></article>) : <div className="management-empty"><Settings2 size={24} /><h3>Nenhuma regra personalizada ainda.</h3><p>Comece por uma coleção recorrente que tenha formatos próprios no seu acervo.</p><button onClick={onNew} className="button button-primary">Criar primeira regra</button></div>}</div></section>;
}

function ClassificationMonitorView({ dashboard, history, isAuthenticated, isBusy, onLogin, onSaveSettings, onRunNow, onSchedule, onExport }: { dashboard?: ClassificationDashboard; history: ClassificationReport[]; isAuthenticated: boolean; isBusy: boolean; onLogin: () => void; onSaveSettings: (settings: Pick<ClassificationMonitorSettings, "alertThresholdCount" | "alertThresholdPercent" | "reportFrequency">) => void; onRunNow: () => void; onSchedule: (enabled: boolean) => void; onExport: () => void }) {
  const [thresholdCount, setThresholdCount] = useState(10);
  const [thresholdPercent, setThresholdPercent] = useState(5);
  const [frequency, setFrequency] = useState<ClassificationMonitorSettings["reportFrequency"]>("weekly");
  useEffect(() => {
    if (!dashboard?.settings) return;
    setThresholdCount(dashboard.settings.alertThresholdCount);
    setThresholdPercent(dashboard.settings.alertThresholdPercent);
    setFrequency(dashboard.settings.reportFrequency);
  }, [dashboard?.settings.alertThresholdCount, dashboard?.settings.alertThresholdPercent, dashboard?.settings.reportFrequency]);
  const percentage = dashboard ? (dashboard.generalPercentBasisPoints / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0";
  const renderGroups = (label: string, groups: { label: string; count: number }[]) => <section className="classification-group"><div><span>{label}</span><small>{groups.reduce((sum, group) => sum + group.count, 0)} ocorrências</small></div>{groups.length ? groups.map((group) => <p key={`${label}-${group.label}`}><b>{group.label}</b><code>{group.count}</code></p>) : <p className="classification-none">Nenhum padrão recorrente ainda.</p>}</section>;
  return <section className="management-view classification-monitor-view">
    <div className="management-heading"><div><p className="eyebrow">Vigilância de classificação</p><h2>Literatura Geral pede uma segunda leitura.</h2><p>Acompanhe os títulos que não encontraram uma regra segura, identifique padrões recorrentes e transforme-os em novas regras de acervo.</p></div><div className="classification-heading-actions"><button onClick={onExport} className="button button-dark"><Download size={17} /> Exportar relatório</button>{!isAuthenticated && <button onClick={onLogin} className="button button-primary"><ShieldCheck size={17} /> Entrar para monitorar</button>}</div></div>
    {!isAuthenticated ? <div className="management-empty"><ShieldCheck size={24} /><h3>Entre para ativar o monitoramento contínuo.</h3><p>Os limites, os relatórios e o histórico ficam vinculados à sua conta para acompanhar novas importações em qualquer dispositivo.</p><button onClick={onLogin} className="button button-primary">Entrar e sincronizar</button></div> : !dashboard ? <div className="management-empty"><Sparkles size={24} /><h3>Preparando o painel de classificação.</h3><p>Os indicadores aparecerão assim que o acervo sincronizado estiver disponível.</p></div> : <>
      {dashboard.exceeded && <div className="classification-alert"><AlertTriangle size={20} /><div><strong>Limite de Literatura Geral atingido.</strong><p>{dashboard.generalCount} itens representam {percentage}% do acervo e ultrapassam pelo menos um dos limites configurados. Revise os grupos abaixo antes da próxima importação.</p></div><button onClick={() => onRunNow()} className="button button-primary" disabled={isBusy}>Gerar relatório</button></div>}
      <div className="classification-ledger"><div><span>Literatura Geral</span><strong>{dashboard.generalCount}</strong><small>itens pendentes</small></div><div><span>Participação</span><strong>{percentage}%</strong><small>do acervo sincronizado</small></div><div><span>Em revisão</span><strong>{dashboard.reviewCount}</strong><small>avisos em aberto</small></div><div><span>Último relatório</span><strong>{dashboard.latestReport ? new Date(dashboard.latestReport.periodEnd).toLocaleDateString("pt-BR") : "—"}</strong><small>{dashboard.latestReport ? { import: "importação", manual: "manual", scheduled: "agendado" }[dashboard.latestReport.source] : "ainda não gerado"}</small></div></div>
      <form className="classification-settings" onSubmit={(event) => { event.preventDefault(); onSaveSettings({ alertThresholdCount: Math.max(1, thresholdCount), alertThresholdPercent: Math.max(1, thresholdPercent), reportFrequency: frequency }); }}>
        <div className="classification-settings-copy"><p className="eyebrow">Limites e cadência</p><h3>Defina quando o acervo deve chamar atenção.</h3><p>O alerta aparece após cada importação se a quantidade absoluta ou o percentual forem atingidos.</p></div>
        <label><span>Quantidade de itens</span><input type="number" min="1" value={thresholdCount} onChange={(event) => setThresholdCount(Math.max(1, Number(event.target.value) || 1))} /></label>
        <label><span>Percentual do lote/acervo</span><input type="number" min="1" max="100" value={thresholdPercent} onChange={(event) => setThresholdPercent(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} /></label>
        <label><span>Relatório</span><select value={frequency} onChange={(event) => setFrequency(event.target.value as ClassificationMonitorSettings["reportFrequency"])}><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label>
        <div className="classification-settings-actions"><button type="submit" className="button button-dark" disabled={isBusy}>Salvar limites</button><button type="button" onClick={() => onRunNow()} className="button button-quiet" disabled={isBusy}>Gerar agora</button><label className="classification-switch"><input type="checkbox" checked={dashboard.settings.reportEnabled} onChange={(event) => onSchedule(event.target.checked)} disabled={isBusy} /><span>Relatório periódico ativo</span></label></div>
      </form>
      <div className="classification-patterns"><div className="classification-patterns-heading"><div><p className="eyebrow">Padrões para novas regras</p><h3>Comece pelo que mais se repete.</h3></div><p>Os agrupamentos consideram apenas os itens ainda classificados como 0L.60 com status Revisar.</p></div><div className="classification-groups">{renderGroups("Autores", dashboard.summary.topAuthors)}{renderGroups("Termos", dashboard.summary.topTerms)}{renderGroups("Coleções", dashboard.summary.topCollections)}</div></div>
      <section className="classification-history"><div className="classification-history-heading"><div><p className="eyebrow">Registro de acompanhamento</p><h3>Relatórios recentes</h3></div><code>{history.length} registros</code></div>{history.length ? history.slice(0, 8).map((report) => <article key={report.uid}><time>{new Date(report.periodEnd).toLocaleString("pt-BR")}</time><strong>{report.generalCount} em Literatura Geral</strong><span>{(report.generalPercentBasisPoints / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% · {report.reviewCount} em revisão</span><code>{report.source === "scheduled" ? "AGENDADO" : report.source === "import" ? "IMPORTAÇÃO" : "MANUAL"}</code>{report.exceeded && <b>ALERTA</b>}</article>) : <p className="classification-none">Gere o primeiro relatório para construir o histórico de acompanhamento.</p>}</section>
    </>}
  </section>;
}

function BackupView({ backups, githubSettings, githubVersions, isLoadingGitHubVersions, isAuthenticated, isCreating, isGitHubBusy, onCreate, onRestore, onRunGitHub, onScheduleGitHub, onRestoreGitHub, onLogin }: { backups: BackupInfo[]; githubSettings?: GitHubBackupSettings; githubVersions: Array<{ path: string; size: number }>; isLoadingGitHubVersions: boolean; isAuthenticated: boolean; isCreating: boolean; isGitHubBusy: boolean; onCreate: () => void; onRestore: (uid: string) => void; onRunGitHub: () => void; onScheduleGitHub: (enabled: boolean) => void; onRestoreGitHub: (path: string) => void; onLogin: () => void }) {
  const githubScheduled = Boolean(githubSettings?.scheduleCronTaskUid && githubSettings.enabled);
  return <section className="management-view"><div className="management-heading"><div><p className="eyebrow">Segurança e continuidade</p><h2>Seu acervo acompanha você.</h2><p>{isAuthenticated ? "Os registros, regras e vínculos ficam sincronizados na sua conta. Crie cópias de segurança antes de alterações grandes." : "Entre na sua conta para sincronizar o acervo em outros dispositivos e habilitar cópias de segurança."}</p></div><button onClick={isAuthenticated ? onCreate : onLogin} className="button button-primary" disabled={isCreating}><ShieldCheck size={18} /> {isAuthenticated ? isCreating ? "Criando cópia" : "Criar backup" : "Entrar e sincronizar"}</button></div><div className="sync-ledger"><div><span>ESTADO</span><strong>{isAuthenticated ? "Sincronizado" : "Somente neste navegador"}</strong></div><div><span>CONTEÚDO</span><strong>Livros, regras e exemplares</strong></div><div><span>RESTAURAÇÃO</span><strong>Por cópia datada</strong></div></div>{isAuthenticated && <><section className="github-backup-panel"><div className="github-backup-copy"><p className="eyebrow">Cópia externa pessoal</p><h3>GitHub privado</h3><p>Uma lista JSON datada é enviada para <code>{githubSettings?.repository || "stokkr-coder/Shinko-Toshokan"}</code>. Arquivos digitais não são incluídos.</p><small>{githubSettings?.lastBackupAt ? `Último envio: ${new Date(githubSettings.lastBackupAt).toLocaleString("pt-BR")}` : "Nenhuma cópia externa enviada ainda."}{githubSettings?.lastError ? ` Último aviso: ${githubSettings.lastError}` : ""}</small></div><div className="github-backup-actions"><button onClick={onRunGitHub} className="button button-primary" disabled={isGitHubBusy}><FolderArchive size={17} /> {isGitHubBusy ? "Enviando" : "Enviar agora"}</button><button onClick={() => onScheduleGitHub(!githubScheduled)} className="button button-quiet" disabled={isGitHubBusy}>{githubScheduled ? "Pausar diário" : "Ativar diário"}</button><a href={`https://github.com/${githubSettings?.repository || "stokkr-coder/Shinko-Toshokan"}/tree/main/backups`} target="_blank" rel="noreferrer" className="button button-quiet">Ver versões</a><span>{githubScheduled ? "Diário às 03:00 (Brasília)" : "Agendamento ainda não ativado"}</span></div></section><section className="github-version-list"><div><p className="eyebrow">Recuperação do catálogo</p><h3>Versões datadas</h3><p>A restauração substitui livros e regras pelo catálogo escolhido. Registros vinculados a livros ausentes são removidos para preservar a integridade.</p></div>{isLoadingGitHubVersions ? <p>Buscando versões salvas…</p> : githubVersions.length ? githubVersions.map((version) => <article key={version.path}><div><code>{version.path.slice(8, 18)}</code><span>{Math.max(1, Math.round(version.size / 1024))} KB</span></div><button onClick={() => onRestoreGitHub(version.path)} className="button button-quiet" disabled={isGitHubBusy}>Restaurar esta versão</button></article>) : <p>Nenhuma versão datada disponível ainda.</p>}</section></>}<div className="backup-list">{backups.length ? backups.map((backup) => <article className="backup-row" key={backup.uid}><div><code>BK</code><strong>{backup.label}</strong><span>{new Date(backup.createdAt).toLocaleString("pt-BR")}</span></div><p>{backup.bookCount} livros · {backup.ruleCount} regras · {backup.assetCount} vínculos</p><button onClick={() => onRestore(backup.uid)} className="button button-quiet">Restaurar</button></article>) : <div className="management-empty"><ShieldCheck size={24} /><h3>Nenhuma cópia de segurança criada.</h3><p>Crie a primeira cópia após importar ou revisar o acervo.</p></div>}</div></section>;
}

function ReadingNowShelf({ items, onOpenReading }: { items: ReturnType<typeof deriveReadingNow>; onOpenReading: (bookUid: string) => void }) {
  return <section className="reading-now-shelf"><div className="reading-now-heading"><div><p className="eyebrow">Estante ativa</p><h2>Lendo agora</h2><p>Obras cujo último registro indica uma leitura em andamento.</p></div><code>{items.length} EM CURSO</code></div>{items.length ? <div className="reading-now-grid">{items.map((item) => <article className="reading-now-card" key={item.uid}><div className="reading-now-cover">{item.coverUrl ? <img src={item.coverUrl} alt={`Capa de ${item.title}`} /> : <div><BookOpen size={28} /></div>}</div><div className="reading-now-copy"><p className="eyebrow">{item.author || "Autor a confirmar"}</p><h3>{item.title}</h3><div className="reading-now-progress"><div style={{ width: `${Math.min(100, item.progress)}%` }} /><span>{item.progress}%{item.page ? ` · p. ${item.page}` : ""}</span></div><p className="reading-now-note">{item.note || "Sem anotação recente."}</p><time className="reading-now-updated">Atualizado em {new Date(item.lastUpdated).toLocaleString("pt-BR")}</time><button onClick={() => onOpenReading(item.uid)} className="button button-quiet">Registrar avanço <ArrowUpRight size={15} /></button></div></article>)}</div> : <div className="reading-now-empty"><BookOpen size={22} /><p>Nenhuma leitura em andamento. Registre o início de uma obra no diário para colocá-la nesta estante.</p></div>}</section>;
}

function WantToReadView({ items, records, metadata, isAuthenticated, onLogin, onSave, onRemove, onMove, onBegin, isBusy }: { items: WantToReadItem[]; records: BookRecord[]; metadata: BookMetadata[]; isAuthenticated: boolean; onLogin: () => void; onSave: (item: WantToReadItem, priority: WantToReadItem["priority"], note: string) => void; onRemove: (item: WantToReadItem) => void; onMove: (item: WantToReadItem, direction: -1 | 1) => void; onBegin: (item: WantToReadItem) => void; isBusy: boolean }) {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  return <section className="management-view want-to-read-view"><div className="management-heading"><div><p className="eyebrow">Planejamento de leitura</p><h2>As próximas obras já têm lugar na estante.</h2><p>Adicione títulos pelo acervo, defina prioridade e anote o motivo da escolha. Ao começar, a obra entra no diário e aparece em “Lendo agora”.</p></div>{!isAuthenticated && <button onClick={onLogin} className="button button-primary"><ShieldCheck size={18} /> Entrar para sincronizar</button>}</div>{ordered.length ? <div className="want-to-read-list">{ordered.map((item, index) => <WantToReadCard key={item.uid} item={item} index={index} total={ordered.length} book={records.find((record) => record.uid === item.bookUid)} coverUrl={metadata.find((entry) => entry.bookUid === item.bookUid)?.coverUrl || ""} isBusy={isBusy} onSave={onSave} onRemove={onRemove} onMove={onMove} onBegin={onBegin} />)}</div> : <div className="management-empty want-to-read-empty"><BookMarked size={24} /><h3>A lista ainda está vazia.</h3><p>Abra o Acervo e use o marcador em uma ficha para colocar uma obra no seu próximo ciclo de leitura.</p></div>}</section>;
}

function WantToReadCard({ item, index, total, book, coverUrl, isBusy, onSave, onRemove, onMove, onBegin }: { item: WantToReadItem; index: number; total: number; book?: BookRecord; coverUrl: string; isBusy: boolean; onSave: (item: WantToReadItem, priority: WantToReadItem["priority"], note: string) => void; onRemove: (item: WantToReadItem) => void; onMove: (item: WantToReadItem, direction: -1 | 1) => void; onBegin: (item: WantToReadItem) => void }) {
  const [priority, setPriority] = useState(item.priority);
  const [note, setNote] = useState(item.note);
  useEffect(() => { setPriority(item.priority); setNote(item.note); }, [item.note, item.priority]);
  return <article className="want-to-read-card"><div className="want-to-read-order"><code>{String(index + 1).padStart(2, "0")}</code><button type="button" onClick={() => onMove(item, -1)} disabled={isBusy || index === 0} aria-label={`Subir ${book?.title || "obra"}`}><ChevronUp size={16} /></button><button type="button" onClick={() => onMove(item, 1)} disabled={isBusy || index === total - 1} aria-label={`Descer ${book?.title || "obra"}`}><ChevronDown size={16} /></button></div><div className="want-to-read-cover">{coverUrl ? <img src={coverUrl} alt={`Capa de ${book?.title || "obra"}`} /> : <BookMarked size={29} />}</div><form className="want-to-read-copy" onSubmit={(event) => { event.preventDefault(); onSave(item, priority, note); }}><div className="want-to-read-title"><div><p className="eyebrow">{book?.author || "Autor a confirmar"}</p><h3>{book?.title || "Obra removida do acervo"}</h3>{book?.collection && <span>{book.collection}{book.seriesNumber ? ` · ${book.seriesNumber}` : ""}</span>}</div><label><span>Prioridade</span><select aria-label={`Prioridade de ${book?.title || "obra"}`} value={priority} onChange={(event) => setPriority(event.target.value as WantToReadItem["priority"])}><option value="Alta">Alta</option><option value="Média">Média</option><option value="Baixa">Baixa</option></select></label></div><label className="want-to-read-note"><span>Nota de leitura</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Por que esta obra entra agora na sua fila?" /></label><div className="want-to-read-actions"><button type="submit" className="button button-quiet" disabled={isBusy}>Salvar planejamento</button><button type="button" onClick={() => onBegin(item)} className="button button-primary" disabled={isBusy || !book}><BookOpen size={16} /> Começar a ler</button><button type="button" onClick={() => onRemove(item)} className="delete-button" disabled={isBusy}>Remover</button></div></form></article>;
}

function ReadingGoalCard({ period, title, label, target, completed, value, onChange, onSaveGoal, isSaving }: { period: ReadingGoal["period"]; title: string; label: string; target: number; completed: number; value: string; onChange: (value: string) => void; onSaveGoal: (period: ReadingGoal["period"], target: number) => void; isSaving: boolean }) {
  const percentage = target ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  return <form className="reading-goal-card" onSubmit={(event) => { event.preventDefault(); onSaveGoal(period, Number(value)); }}><div><span>{label}</span><strong>{title}</strong></div><div className="goal-progress"><div style={{ width: `${percentage}%` }} /><code>{completed} / {target || "—"} livros</code></div><label><span>Meta de livros</span><input type="number" min="1" value={value} onChange={(event) => onChange(event.target.value)} /></label><button className="button button-quiet" disabled={isSaving}>{isSaving ? "Salvando" : "Salvar meta"}</button></form>;
}

function ReadingGoalsPanel({ goals, events, isAuthenticated, onSaveGoal, onExport, isSaving }: { goals: ReadingGoal[]; events: ReadingEvent[]; isAuthenticated: boolean; onSaveGoal: (period: ReadingGoal["period"], target: number) => void; onExport: () => void; isSaving: boolean }) {
  const keys = readingPeriodKeys();
  const monthlyGoal = goals.find((goal) => goal.period === "monthly" && goal.periodKey === keys.monthly)?.targetBooks || 0;
  const yearlyGoal = goals.find((goal) => goal.period === "yearly" && goal.periodKey === keys.yearly)?.targetBooks || 0;
  const monthlyCompleted = completedBooksForPeriod(events, "monthly", keys.monthly);
  const yearlyCompleted = completedBooksForPeriod(events, "yearly", keys.yearly);
  const [monthlyTarget, setMonthlyTarget] = useState(String(monthlyGoal || 1));
  const [yearlyTarget, setYearlyTarget] = useState(String(yearlyGoal || 12));
  useEffect(() => { setMonthlyTarget(String(monthlyGoal || 1)); }, [monthlyGoal]);
  useEffect(() => { setYearlyTarget(String(yearlyGoal || 12)); }, [yearlyGoal]);
  return <section className="reading-goals-panel"><div className="reading-goals-heading"><div><p className="eyebrow">Ritmo de leitura</p><h2>Metas que acompanham seu diário.</h2><p>O progresso conta obras concluídas uma única vez em cada período.</p></div><button onClick={onExport} className="button button-dark"><Download size={17} /> Exportar diário Excel</button></div><div className="reading-goals-grid"><ReadingGoalCard period="monthly" title={keys.monthly} label="META DO MÊS" target={monthlyGoal} completed={monthlyCompleted} value={monthlyTarget} onChange={setMonthlyTarget} onSaveGoal={onSaveGoal} isSaving={isSaving} /><ReadingGoalCard period="yearly" title={keys.yearly} label="META DO ANO" target={yearlyGoal} completed={yearlyCompleted} value={yearlyTarget} onChange={setYearlyTarget} onSaveGoal={onSaveGoal} isSaving={isSaving} /></div>{!isAuthenticated && <p className="goals-login-note">Entre na sua conta para manter metas e diário sincronizados entre dispositivos.</p>}</section>;
}

function ReadingView({ records, metadata, events, selectedBookUid, isAuthenticated, onAdd, onLogin, isSaving }: { records: BookRecord[]; metadata: BookMetadata[]; events: ReadingEvent[]; selectedBookUid: string; isAuthenticated: boolean; onAdd: (bookUid: string, type: ReadingEvent["type"], page: number, progress: number, note: string) => void; onLogin: () => void; isSaving: boolean }) {
  const [bookUid, setBookUid] = useState("");
  const [type, setType] = useState<ReadingEvent["type"]>("progress");
  const [page, setPage] = useState("0");
  const [progress, setProgress] = useState("0");
  const [note, setNote] = useState("");
  const selectedUid = bookUid || selectedBookUid || records[0]?.uid || "";
  const selectedBook = records.find((record) => record.uid === selectedUid);
  const selectedMetadata = metadata.find((item) => item.bookUid === selectedUid);
  const timeline = events.filter((event) => event.bookUid === selectedUid).sort((a, b) => b.occurredAt - a.occurredAt);
  const label = { started: "Início de leitura", progress: "Progresso registrado", finished: "Leitura concluída", abandoned: "Leitura pausada", note: "Anotação" }[type];
  function submit(event: FormEvent) { event.preventDefault(); if (!selectedUid) return; onAdd(selectedUid, type, Math.max(0, Number(page) || 0), Math.min(100, Math.max(0, Number(progress) || 0)), note.trim()); setNote(""); }
  return <section className="management-view reading-view"><div className="management-heading"><div><p className="eyebrow">Diário do leitor</p><h2>O acervo também guarda o caminho da leitura.</h2><p>Registre início, avanço, pausas, conclusão e observações. Cada evento fica vinculado ao livro e sincronizado com a sua conta.</p></div>{!isAuthenticated && <button onClick={onLogin} className="button button-primary"><ShieldCheck size={18} /> Entrar para salvar</button>}</div><div className="reading-grid"><form className="reading-register" onSubmit={submit}><div className="reading-form-heading"><span>REGISTRAR EVENTO</span><strong>{selectedBook?.title || "Escolha um livro"}</strong></div><label className="field"><span>Livro</span><select value={selectedUid} onChange={(event) => setBookUid(event.target.value)}><option value="">Selecione uma ficha</option>{records.map((record) => <option key={record.uid} value={record.uid}>{record.title} — {record.author || "autor a confirmar"}</option>)}</select></label><div className="form-grid"><label className="field"><span>Tipo</span><select value={type} onChange={(event) => setType(event.target.value as ReadingEvent["type"])}><option value="started">Iniciar leitura</option><option value="progress">Registrar progresso</option><option value="finished">Concluir leitura</option><option value="abandoned">Pausar leitura</option><option value="note">Anotação</option></select></label><label className="field"><span>Progresso (%)</span><input type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(event.target.value)} /></label><label className="field"><span>Página</span><input type="number" min="0" value={page} onChange={(event) => setPage(event.target.value)} /></label><div className="generated-preview"><span>Evento</span><code>{label}</code></div></div><label className="field"><span>Nota opcional</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Impressões, capítulo atual ou próximo passo." rows={3} /></label><div className="dialog-actions"><span /><button disabled={!selectedUid || isSaving} className="button button-primary"><CheckCircle2 size={18} /> {isSaving ? "Salvando" : "Registrar leitura"}</button></div></form><aside className="reading-book-card">{selectedMetadata?.coverUrl ? <img src={selectedMetadata.coverUrl} alt={`Capa de ${selectedBook?.title || "livro"}`} /> : <div className="cover-placeholder"><BookOpen size={34} /></div>}<div><p className="eyebrow">Ficha selecionada</p><h3>{selectedBook?.title || "Nenhum livro selecionado"}</h3><p>{selectedBook?.author || "Selecione um livro para consultar seus registros."}</p>{selectedMetadata && <dl><div><dt>ISBN</dt><dd>{selectedMetadata.isbn}</dd></div><div><dt>Páginas</dt><dd>{selectedMetadata.pageCount || "—"}</dd></div><div><dt>Editora</dt><dd>{selectedMetadata.publisher || "—"}</dd></div></dl>}</div></aside></div><div className="reading-timeline"><div className="timeline-heading"><span>HISTÓRICO</span><strong>{timeline.length} evento{timeline.length === 1 ? "" : "s"}</strong></div>{timeline.length ? timeline.map((event) => <article key={event.uid}><code>{event.type.toUpperCase()}</code><div><strong>{{ started: "Leitura iniciada", progress: "Progresso registrado", finished: "Leitura concluída", abandoned: "Leitura pausada", note: "Anotação" }[event.type]}</strong><p>{event.note || "Sem anotação adicional."}</p></div><div className="timeline-stats"><span>{event.progress}% · p. {event.page || "—"}</span><small>{new Date(event.occurredAt).toLocaleString("pt-BR")}</small></div></article>) : <div className="management-empty"><BookOpen size={24} /><h3>O diário ainda está em branco.</h3><p>Escolha uma ficha e registre o primeiro contato com a obra.</p></div>}</div></section>;
}

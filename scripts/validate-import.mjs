import XLSX from "xlsx";

const source = "/home/ubuntu/upload/book.xlsx";
const workbook = XLSX.readFile(source);
const firstSheet = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
const names = rows
  .map((row) => String(row.Name || row.Nome || row.Título || row.Titulo || Object.values(row)[0] || "").trim())
  .filter(Boolean);

if (!names.length) throw new Error("A planilha não contém uma coluna de títulos reconhecível.");
if (names.length !== 1792) throw new Error(`Quantidade importada inesperada: ${names.length}.`);

const result = {
  sheet: firstSheet,
  rowsRead: names.length,
  firstHeader: Object.keys(rows[0] || {})[0] || "",
  patristicMatches: names.filter((name) => /patr[ií]stica/i.test(name)).length,
  parentheticalAuthorPattern: names.filter((name) => /\([^)]*\)/.test(name)).length,
  finalHyphenPattern: names.filter((name) => /\s[-–—]\s*[^-–—]+$/.test(name)).length,
};

console.log(JSON.stringify(result, null, 2));

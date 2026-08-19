import { strict as assert } from "node:assert";
import XLSX from "xlsx";
import { catalogationDiagnostics } from "../client/src/pages/Home.tsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/book.xlsx");
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
const records = rows
  .map((row) => String(row.Name || row.Nome || row.Título || row.Titulo || Object.values(row)[0] || "").trim())
  .filter(Boolean)
  .map((raw) => catalogationDiagnostics.parseRawBook(raw));

const collectionCounts = records.reduce<Record<string, number>>((acc, record) => {
  if (record.collection) acc[record.collection] = (acc[record.collection] || 0) + 1;
  return acc;
}, {});

assert.equal(records.length, 1792);
assert.ok((collectionCounts.Patrística || 0) >= 40);
assert.ok((collectionCounts.Harbingers || 0) >= 15);
assert.ok((collectionCounts["Battlestar Galactica"] || 0) >= 20);
assert.ok((collectionCounts["Star Wars"] || 0) >= 25);
assert.ok((collectionCounts["O Tempo com Você"] || 0) >= 10);
assert.ok((collectionCounts["The Twelve Kingdoms"] || 0) >= 8);
assert.ok((collectionCounts["Tokyo Ravens"] || 0) >= 10);
assert.ok((collectionCounts["Youjo Senki"] || 0) >= 10);

console.log(JSON.stringify({ rowsImported: records.length, collectionCounts }, null, 2));

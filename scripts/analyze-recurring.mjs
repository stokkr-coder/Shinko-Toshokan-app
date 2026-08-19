import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/book.xlsx");
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
const names = rows.map((row) => String(row.Name || Object.values(row)[0] || "").trim()).filter(Boolean);

const matches = (pattern) => names.filter((name) => pattern.test(name));
const perry = matches(/perry\s+rhodan/i);
const patristica = matches(/patr[ií]stica/i);

console.log(JSON.stringify({
  perryRhodan: { count: perry.length, samples: perry.slice(0, 12) },
  patristica: { count: patristica.length, samples: patristica.slice(0, 12) },
}, null, 2));

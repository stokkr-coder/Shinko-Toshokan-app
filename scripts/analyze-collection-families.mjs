import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/book.xlsx");
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
const names = rows.map((row) => String(row.Name || Object.values(row)[0] || "").trim()).filter(Boolean);

function familyKey(name) {
  const noExtension = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  const withoutLeadingAuthor = noExtension.replace(/^[^–—-]+,\s*[^–—-]+\s*[-–—]\s*/i, "");
  return withoutLeadingAuthor
    .replace(/\b(?:vol(?:ume)?\.?|cap[ií]tulo|chapter|pr)\s*\d+(?:[._-]\d+)?\b/gi, "#")
    .replace(/\b\d{1,4}\b/g, "#")
    .split(/\s[-–—]\s/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

const counts = new Map();
for (const name of names) {
  const key = familyKey(name);
  if (key.length >= 5) counts.set(key, (counts.get(key) || 0) + 1);
}

const topFamilies = [...counts.entries()]
  .filter(([, count]) => count >= 3)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
  .slice(0, 40)
  .map(([family, count]) => ({ family, count, samples: names.filter((name) => familyKey(name) === family).slice(0, 3) }));

console.log(JSON.stringify(topFamilies, null, 2));

import { strict as assert } from "node:assert";
import { catalogationDiagnostics } from "../client/src/pages/Home.tsx";

const patristica = catalogationDiagnostics.parseRawBook("Patrística Vol. 10 - Confissoes - Santo Agostinho");
assert.equal(patristica.collection, "Patrística");
assert.equal(patristica.seriesCode, "PATR");
assert.equal(patristica.seriesNumber, "Vol. 10");
assert.equal(patristica.author, "AGOSTINHO, Santo");
assert.equal(patristica.media, "0T");
assert.equal(patristica.genre, "01");
assert.equal(patristica.shinkoId, "ST.0T.01.AGOS-10");

const perry = catalogationDiagnostics.parseRawBook("Perry Rhodan - PR1825 - Luta por Trieger - Hubert Haensel");
assert.equal(perry.collection, "Perry Rhodan");
assert.equal(perry.seriesCode, "PR1825");
assert.equal(perry.seriesNumber, "Edição 1825");
assert.equal(perry.author, "HAENSEL, Hubert");
assert.equal(perry.media, "0L");
assert.equal(perry.genre, "41");
assert.equal(perry.shinkoId, "ST.0L.41.HAEN-00");

const harbingers = catalogationDiagnostics.parseRawBook("Harbingers - book 02 - The Haunted (Peretti, Frank E)");
assert.equal(harbingers.collection, "Harbingers");
assert.equal(harbingers.seriesCode, "HARB");
assert.equal(harbingers.genre, "35");
assert.equal(harbingers.volume, "02");

const starWars = catalogationDiagnostics.parseRawBook("STAR WARS - A Alta República (Fase 1) 01 - A Luz dos Jedi (Charles Soul)");
assert.equal(starWars.collection, "Star Wars");
assert.equal(starWars.seriesCode, "SW01");
assert.equal(starWars.genre, "43");

const youjo = catalogationDiagnostics.parseRawBook("Youjo Senki Vol. 03 - Carlo Zen, Shinobu Shinotsuki");
assert.equal(youjo.collection, "Youjo Senki");
assert.equal(youjo.author, "ZEN, Carlo");
assert.equal(youjo.media, "3M");
assert.equal(youjo.volume, "03");

const filters = { query: "", status: "all" as const, genre: "all", author: "all", collection: "all", media: "all", extension: "all" };
assert.equal(catalogationDiagnostics.matchesAdvancedFilters(perry, { ...filters, genre: "41" }), true);
assert.equal(catalogationDiagnostics.matchesAdvancedFilters(perry, { ...filters, author: "HAENSEL, Hubert" }), true);
assert.equal(catalogationDiagnostics.matchesAdvancedFilters(patristica, { ...filters, collection: "Perry Rhodan" }), false);
assert.equal(catalogationDiagnostics.matchesAdvancedFilters(patristica, { ...filters, query: "agostinho" }), true);
assert.equal(catalogationDiagnostics.matchesAdvancedFilters(perry, { ...filters, media: "0L", extension: "epub" }), true);
assert.equal(catalogationDiagnostics.matchesAdvancedFilters(perry, { ...filters, media: "3M" }), false);

console.log("Regras de coleção, autoria e filtros avançados: OK");

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicDir = resolve(import.meta.dirname, "..", "public");

describe("ativos PWA da Biblioteca Shinko", () => {
  it("declara o favicon e o manifest com os ícones instaláveis", () => {
    const html = readFileSync(resolve(import.meta.dirname, "..", "index.html"), "utf8");
    const manifest = JSON.parse(readFileSync(resolve(publicDir, "manifest.webmanifest"), "utf8"));

    expect(html).toContain('href="/favicon.ico"');
    expect(html).toContain('href="/manifest.webmanifest"');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512" }),
    ]));
    expect(existsSync(resolve(publicDir, "favicon.ico"))).toBe(true);
    expect(existsSync(resolve(publicDir, "icons", "icon-192.png"))).toBe(true);
    expect(existsSync(resolve(publicDir, "icons", "icon-512.png"))).toBe(true);
  });
});

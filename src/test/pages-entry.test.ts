import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preparePages } from "../../scripts/prepare-pages.mjs";
describe("GitHub Pages member documents", () => {
  it("ships the same current entry for login, dashboard, account and fallback", async () => {
    const directory = await mkdtemp(join(tmpdir(), "serasona-entry-"));
    try {
      const entry = '<html><script src="/assets/current-release.js"></script></html>';
      await writeFile(join(directory, "index.html"), entry);
      await preparePages(directory);
      for (const path of ["login/index.html", "dashboard/index.html", "account/index.html", "docs/index.html", "docs/serasona-score/index.html", "checkin/index.html", "checkin/phone/index.html", "voice/index.html", "signup/index.html", "reset-password/index.html", "science/index.html", "models/index.html", "terms/index.html", "privacy/index.html", "pricing/index.html", "admin/index.html", "history/index.html", "detailed-analysis/index.html", "404.html"]) expect(await readFile(join(directory, path), "utf8")).toBe(entry);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});

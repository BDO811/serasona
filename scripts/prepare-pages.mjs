import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Give member entry URLs a current HTML document with a 200 response instead
 * of relying on a cached GitHub Pages 404 document to bootstrap the app. */
export async function preparePages(directory = "dist") {
  const root = resolve(directory);
  const html = await readFile(resolve(root, "index.html"), "utf8");
  for (const route of ["login", "dashboard", "account"]) {
    const folder = resolve(root, route);
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, "index.html"), html);
  }
  await writeFile(resolve(root, "404.html"), html);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await preparePages();

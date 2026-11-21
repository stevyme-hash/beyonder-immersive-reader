import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public/content");
const books = [
  { id: "lotm", title: "Lord of the Mysteries", folder: "lotm" },
  { id: "coi", title: "Circle of Inevitability", folder: "coi" }
];

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator > 0) data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return data;
}

for (const book of books) {
  const folder = path.join(root, book.folder);
  fs.mkdirSync(folder, { recursive: true });
  const chapters = fs.readdirSync(folder)
    .filter(name => name.endsWith(".md") && Number(path.basename(name, ".md")) > 0)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(name => {
      const text = fs.readFileSync(path.join(folder, name), "utf8");
      const meta = parseFrontmatter(text);
      return {
        number: Number(meta.index || meta.slug || name.replace(/\.md$/, "")),
        slug: meta.slug || name.replace(/\.md$/, ""),
        title: meta.title || `Chapter ${meta.index || name.replace(/\.md$/, "")}`,
        category: meta.category || "Volume",
        section: meta.section || "",
        discussion: Number(meta.discussion || 0),
        file: name
      };
    });
  fs.writeFileSync(path.join(folder, "manifest.json"), JSON.stringify({
    id: book.id,
    title: book.title,
    chapters
  }, null, 2));
}

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

/**
 * Inline a controller SVG so the renderer can decorate it (hotspots, highlights, stick motion).
 * Ids are prefixed because both drawings define the same gradient/filter names.
 */
async function inlineArt(file, prefix) {
  const source = await readFile(file, "utf8");
  return source
    .replace(/<\?xml[^>]*\?>\s*/, "")
    .replace(/<title[^>]*>[\s\S]*?<\/title>\s*/, "")
    .replace(/<desc[^>]*>[\s\S]*?<\/desc>\s*/, "")
    .replace(/\saria-labelledby="[^"]*"/, "")
    .replace(/<svg([^>]*?)\swidth="\d+"\sheight="\d+"/, `<svg$1 data-art="${prefix}"`)
    .replace(/\sid="([^"]+)"/g, ` id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}-$1"`);
}

await mkdir("dist/ui/renderer", { recursive: true });
const html = (await readFile("src/ui/renderer/index.html", "utf8"))
  .replace("<!--art:physical-->", await inlineArt("src/ui/renderer/art/dualshock4.svg", "ds4"))
  .replace("<!--art:xbox-->", await inlineArt("src/ui/renderer/art/xbox-series.svg", "xbx"));
await writeFile("dist/ui/renderer/index.html", html);
await cp("src/ui/renderer/style.css", "dist/ui/renderer/style.css");
await cp("build/icon.svg", "dist/ui/renderer/icon.svg");
await cp("build/icon.png", "dist/ui/icon.png");

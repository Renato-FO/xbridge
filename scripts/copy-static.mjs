import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/ui/renderer", { recursive: true });
await cp("src/ui/renderer/index.html", "dist/ui/renderer/index.html");
await cp("src/ui/renderer/style.css", "dist/ui/renderer/style.css");

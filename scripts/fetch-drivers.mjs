// Download the driver installers bundled into the Windows setup, pinned by SHA-256.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const drivers = [
  {
    file: "ViGEmBus_1.22.0_x64_x86_arm64.exe",
    url: "https://github.com/nefarius/ViGEmBus/releases/download/v1.22.0/ViGEmBus_1.22.0_x64_x86_arm64.exe",
    sha256: "89220a7865076b342892f98865f3499fb7c4cfd673159e89d352c360fd014c6a",
  },
  {
    file: "HidHide_1.5.230_x64.exe",
    url: "https://github.com/nefarius/HidHide/releases/download/v1.5.230.0/HidHide_1.5.230_x64.exe",
    sha256: "f4bbbcb82e6258641b887c74bc81c4c5f66e4aa811808dfc304347687b7605f6",
  },
];

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

await mkdir("build/drivers", { recursive: true });
for (const { file, url, sha256: expected } of drivers) {
  const path = `build/drivers/${file}`;
  const existing = await readFile(path).catch(() => undefined);
  if (existing && sha256(existing) === expected) continue;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${file}: download failed (${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  if (sha256(data) !== expected) throw new Error(`${file}: checksum mismatch`);
  await writeFile(path, data);
  console.log(`downloaded ${file}`);
}

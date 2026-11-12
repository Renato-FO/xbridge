import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const exe = "XBridge.VirtualController.exe";

/**
 * Locate the .NET bridge. A packaged app ships one self-contained copy in `resources/native`;
 * a dev checkout uses the per-role build folders under `artifacts/` (two copies, so rebuilding
 * one never fights a running process over a locked file).
 */
export function nativeExecutable(role: "native" | "native-output"): string {
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const packaged = join(resources, "native", exe);
    if (existsSync(packaged)) return packaged;
  }
  return fileURLToPath(new URL(`../../artifacts/${role}/${exe}`, import.meta.url));
}

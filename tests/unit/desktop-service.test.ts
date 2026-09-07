import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { DesktopService } from "../../src/ui/desktop-service.js";
import { defaultMapping } from "../../src/ui/contracts.js";
it("persists mappings and rejects corrupt files instead of applying them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xbridge-test-"));
  try {
    const service = new DesktopService(directory);
    expect(await service.loadMapping()).toEqual(defaultMapping);
    const mapping = { ...defaultMapping, Cross: "B" };
    await service.saveMapping(mapping);
    expect(await new DesktopService(directory).loadMapping()).toEqual(mapping);
    await expect(service.saveMapping({})).rejects.toThrow();
    expect(await service.loadMapping()).toEqual(mapping);
    const legacy = Object.fromEntries(Object.entries(mapping).slice(0, 12));
    await writeFile(join(directory, "mapping.json"), JSON.stringify(legacy));
    expect(await service.loadMapping()).toEqual(mapping);
    await writeFile(join(directory, "mapping.json"), "{}");
    await expect(service.loadMapping()).rejects.toThrow();
    expect(() => {
      service.capture("neutral");
    }).toThrow("Connect a controller");
    expect(() => {
      service.capture("../outside");
    }).toThrow("lowercase label");
    await service.disconnect();
    await service.disconnect();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

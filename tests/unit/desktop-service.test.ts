import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import type { InputIsolation } from "../../src/isolation/hidhide.js";
import { DesktopService, type VirtualOutput } from "../../src/ui/desktop-service.js";
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
class FakeOutput implements VirtualOutput {
  status: "stopped" | "starting" | "active" = "stopped";
  error = "";
  userIndex: number | undefined;
  inputs: unknown[] = [];
  starts = 0;
  setInput(report: unknown) {
    this.inputs.push(report);
    if (report === undefined) this.status = "stopped";
  }
  start() {
    this.starts++;
    this.status = "active";
    return Promise.resolve();
  }
  stop() {
    this.status = "stopped";
    return Promise.resolve();
  }
}
it("gives each connected controller its own Xbox output and adds late joiners", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xbridge-test-"));
  try {
    const created: FakeOutput[] = [];
    const service = new DesktopService(directory, () => {
      const output = new FakeOutput();
      created.push(output);
      return output;
    });
    const first = { id: 0, input: { Cross: 1 } };
    // A single controller shows no extra controllers and output stays off until requested.
    service.route([first]);
    expect(service.snapshot().controllers?.map((c) => c.id)).toEqual([0]);
    expect(created[0]?.status).toBe("stopped");
    await created[0]?.start();
    // A second controller connected while output runs starts its own output.
    service.route([first, { id: 2, input: { Circle: 1 } }]);
    expect(created).toHaveLength(2);
    expect(created[1]?.starts).toBe(1);
    const state = service.snapshot();
    expect(state.controllers?.map((c) => [c.id, c.outputStatus])).toEqual([
      [0, "active"],
      [2, "active"],
    ]);
    expect(state.controllers?.[1]?.mappedInput["B"]).toBe(1);
    expect(state.outputStatus).toBe("active");
    // Unplugging one releases only its virtual controller.
    service.route([first]);
    expect(created[1]?.status).toBe("stopped");
    expect(created[1]?.inputs.at(-1)).toBeUndefined();
    expect(created[0]?.status).toBe("active");
    expect(service.snapshot().controllers).toHaveLength(1);
    await service.stopOutput();
    expect(service.snapshot().outputStatus).toBe("stopped");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it("hides physical controllers while output runs and gives them back afterwards", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xbridge-test-"));
  try {
    const calls: string[] = [];
    let active = false;
    const isolation = {
      get active() {
        return active;
      },
      current: { status: "off", hidden: 0, detail: "" },
      acquire() {
        calls.push("acquire");
        active = true;
        return Promise.resolve({ status: "active", hidden: 1, detail: "" });
      },
      release() {
        calls.push("release");
        active = false;
        return Promise.resolve({ status: "off", hidden: 0, detail: "" });
      },
      recover: () => Promise.resolve(),
    } as unknown as InputIsolation;
    const created: FakeOutput[] = [];
    const service = new DesktopService(
      directory,
      () => {
        const output = new FakeOutput();
        created.push(output);
        return output;
      },
      isolation,
      0,
    );
    const first = { id: 0, input: { Cross: 1 } };
    service.route([first]);
    await created[0]?.start();
    // A late joiner starts its output and is then hidden from games too.
    service.route([first, { id: 1, input: {} }]);
    await vi.waitFor(() => {
      expect(calls).toEqual(["acquire"]);
    });
    // Every controller unplugged: nothing is left hidden.
    service.route([]);
    expect(calls).toEqual(["acquire", "release"]);
    await service.stopOutput();
    expect(calls.at(-1)).toBe("release");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

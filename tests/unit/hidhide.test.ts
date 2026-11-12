import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  InputIsolation,
  isSourceController,
  parseDevices,
  parseQuotedList,
} from "../../src/isolation/hidhide.js";

const ds4Bt =
  "HID\\{00001124-0000-1000-8000-00805f9b34fb}_VID&0002054c_PID&05c4\\a&26a4252a&3&0000";
const ds4Usb = "HID\\VID_054C&PID_05C4&MI_03\\7&1&0&0000";
const keyboard = "HID\\VID_046D&PID_C336&MI_01&Col02\\8&340a73be&0&0001";
const otherHidden = "HID\\VID_0810&PID_0001\\7&240980b5&0&0000";

/** In-memory HidHide that answers the CLI queries and applies sequenced changes. */
class FakeHidHide {
  apps = ["C:\\Tools\\Other.exe"];
  devices = [otherHidden];
  cloak = false;
  inverse = false;
  present = [ds4Bt, keyboard];
  calls: string[][] = [];
  run = (args: readonly string[]): Promise<string> => {
    this.calls.push([...args]);
    const first = args[0];
    if (first === "--inv-state") return Promise.resolve(this.inverse ? "--inv-on" : "--inv-off");
    if (first === "--cloak-state")
      return Promise.resolve(this.cloak ? "--cloak-on" : "--cloak-off");
    if (first === "--app-list")
      return Promise.resolve(this.apps.map((app) => `--app-reg "${app}"`).join("\n"));
    if (first === "--dev-list")
      return Promise.resolve(this.devices.map((dev) => `--dev-hide "${dev}"`).join("\n"));
    if (first === "--dev-all")
      return Promise.resolve(
        JSON.stringify([
          {
            friendlyName: "x",
            devices: [...this.present, otherHidden].map((path) => ({
              deviceInstancePath: path,
              present: this.present.includes(path),
            })),
          },
        ]),
      );
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      const value = args[i + 1] ?? "";
      if (flag === "--app-reg") this.apps.push(value);
      if (flag === "--dev-hide") this.devices.push(value);
      if (flag === "--dev-unhide") this.devices = this.devices.filter((dev) => dev !== value);
      if (flag === "--cloak-on") this.cloak = true;
      if (flag === "--cloak-off") this.cloak = false;
    }
    return Promise.resolve("");
  };
}

async function setup(fake = new FakeHidHide()) {
  const directory = await mkdtemp(join(tmpdir(), "xbridge-iso-"));
  const stateFile = join(directory, "isolation.json");
  const isolation = new InputIsolation(fake.run, ["C:\\XBridge\\reader.exe"], stateFile);
  return { fake, isolation, stateFile };
}

describe("HidHide parsing", () => {
  it("matches DualShock 4 over USB and Bluetooth only", () => {
    expect(isSourceController(ds4Bt)).toBe(true);
    expect(isSourceController(ds4Usb)).toBe(true);
    expect(isSourceController(keyboard)).toBe(false);
  });
  it("reads quoted list entries and device JSON", () => {
    expect(parseQuotedList('--app-reg "C:\\a b.exe"\n--app-reg "D:\\c.exe"\n')).toEqual([
      "C:\\a b.exe",
      "D:\\c.exe",
    ]);
    expect(
      parseDevices('[{"devices":[{"deviceInstancePath":"X","present":true},{"present":false}]}]'),
    ).toEqual([{ instancePath: "X", present: true }]);
  });
});

describe("InputIsolation", () => {
  it("hides only the present controller and restores only its own changes", async () => {
    const { fake, isolation, stateFile } = await setup();
    const acquired = await isolation.acquire();
    expect(acquired.status).toBe("active");
    expect(fake.devices).toEqual([otherHidden, ds4Bt]);
    expect(fake.apps).toContain("C:\\XBridge\\reader.exe");
    expect(fake.cloak).toBe(true);
    expect(JSON.parse(await readFile(stateFile, "utf8"))).toEqual({
      devices: [ds4Bt],
      cloak: true,
    });

    const released = await isolation.release();
    expect(released.status).toBe("off");
    expect(fake.devices).toEqual([otherHidden]);
    // Another app's device is still listed, so global hiding stays on for it.
    expect(fake.cloak).toBe(true);
    await expect(readFile(stateFile, "utf8")).rejects.toThrow();
  });
  it("turns cloaking back off when nothing else is hidden", async () => {
    const fake = new FakeHidHide();
    fake.devices = [];
    const { isolation } = await setup(fake);
    await isolation.acquire();
    await isolation.release();
    expect(fake.cloak).toBe(false);
    expect(fake.devices).toEqual([]);
  });
  it("leaves a cloak that was already on untouched", async () => {
    const fake = new FakeHidHide();
    fake.devices = [];
    fake.cloak = true;
    const { isolation } = await setup(fake);
    await isolation.acquire();
    await isolation.release();
    expect(fake.cloak).toBe(true);
  });
  it("refuses to change an inverse-mode configuration", async () => {
    const fake = new FakeHidHide();
    fake.inverse = true;
    const { isolation } = await setup(fake);
    expect((await isolation.acquire()).status).toBe("failed");
    expect(fake.devices).toEqual([otherHidden]);
  });
  it("reports failure when no controller is present", async () => {
    const fake = new FakeHidHide();
    fake.present = [keyboard];
    const { isolation } = await setup(fake);
    expect((await isolation.acquire()).status).toBe("failed");
    expect(fake.cloak).toBe(false);
  });
  it("undoes changes left by a crashed run", async () => {
    const fake = new FakeHidHide();
    fake.devices = [];
    const first = await setup(fake);
    await first.isolation.acquire();
    // Simulate a crash: a fresh instance only has the state file to go on.
    const restarted = new InputIsolation(fake.run, [], first.stateFile);
    await restarted.recover();
    expect(fake.devices).toEqual([]);
    expect(fake.cloak).toBe(false);
  });
  it("is unavailable without HidHide", async () => {
    const isolation = new InputIsolation(undefined, [], join(tmpdir(), "none.json"));
    expect((await isolation.acquire()).status).toBe("unavailable");
  });
});

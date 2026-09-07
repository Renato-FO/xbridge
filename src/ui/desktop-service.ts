import HID from "node-hid";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { NodeHidDeviceProvider } from "../devices/node-hid-device-provider.js";
import { controls, defaultMapping, validateMapping, type MonitorState } from "./contracts.js";
import { JoystickMonitor } from "../devices/joystick-monitor.js";
import { mapPreview } from "../devices/windows-joystick.js";
import { OutputClient } from "../virtual-controller/output-client.js";
import { toXboxReport } from "../virtual-controller/report.js";

export class DesktopService {
  private readonly output = new OutputClient();
  private activeMapping = { ...defaultMapping };
  private readonly joystick = new JoystickMonitor((input) => {
    this.output.setInput(input ? toXboxReport(mapPreview(input, this.activeMapping)) : undefined);
  });
  async startOutput() {
    this.activeMapping = await this.loadMapping();
    const input = this.joystick.input;
    this.output.setInput(input ? toXboxReport(mapPreview(input, this.activeMapping)) : undefined);
    await this.output.start();
  }
  async stopOutput() {
    await this.output.stop();
  }
  private preview = { ...defaultMapping };
  previewMapping(value: unknown) {
    this.preview = validateMapping(value);
  }
  private source: HID.HIDAsync | undefined;
  private opening = false;
  private generation = 0;
  private captureTimer: ReturnType<typeof setTimeout> | undefined;
  private recording:
    { label: string; start: number; reports: { elapsedMs: number; hex: string }[] } | undefined;
  private state: MonitorState = {
    connected: false,
    name: "No controller",
    count: 0,
    bytes: [],
    error: "",
    capturing: false,
    captureResult: "",
  };
  constructor(private readonly directory: string) {}
  snapshot(): MonitorState {
    return {
      ...this.state,
      bytes: [...this.state.bytes],
      input: this.joystick.input ?? {},
      mappedInput: mapPreview(this.joystick.input ?? {}, this.preview),
      inputAvailable: this.joystick.input !== undefined,
      inputError: this.joystick.error,
      outputStatus: this.output.status,
      outputError: this.output.error,
    };
  }
  async connect(): Promise<void> {
    this.joystick.start();
    if (this.source || this.opening) return;
    this.opening = true;
    const generation = this.generation;
    try {
      const devices = (await new NodeHidDeviceProvider().listDevices()).filter(
        (d) =>
          d.vendorId === 0x054c && d.productId === 0x05c4 && d.usagePage === 1 && d.usage === 5,
      );
      const device = devices[0];
      if (devices.length !== 1 || !device?.path)
        throw new Error("Connect exactly one 054C:05C4 controller and press PS, then retry.");
      const source = await HID.HIDAsync.open(device.path);
      if (generation !== this.generation) {
        await source.close();
        return;
      }
      this.source = source;
      this.state = {
        connected: true,
        name: `${device.product ?? "Controller"} · ${device.connectionType} · 054C:05C4`,
        count: 0,
        bytes: [],
        error: "",
        capturing: false,
        captureResult: "",
      };
      source.on("data", (report: Buffer) => {
        if (report.length < 1 || report.length > 4096) {
          this.state.error = "Invalid report length.";
          return;
        }
        this.state.count++;
        this.state.bytes = Array.from(report);
        if (this.recording) {
          this.recording.reports.push({
            elapsedMs: performance.now() - this.recording.start,
            hex: report.toString("hex"),
          });
          if (this.recording.reports.length >= 2000) void this.finishCapture("report-limit");
        }
      });
      source.on("error", (error: Error) => {
        this.state.error = error.message;
        void this.disconnect().catch((failure: unknown) => {
          this.state.error = String(failure);
        });
      });
    } finally {
      this.opening = false;
    }
  }
  async disconnect(): Promise<void> {
    await this.output.stop();
    await this.joystick.stop();
    this.generation++;
    const source = this.source;
    this.source = undefined;
    this.state.connected = false;
    this.state.bytes = [];
    try {
      await this.finishCapture("disconnected");
    } finally {
      await source?.close();
    }
  }
  capture(label: unknown): void {
    if (typeof label !== "string" || !/^[a-z0-9-]{1,64}$/.test(label))
      throw new Error("Use a lowercase label with letters, numbers, or hyphens.");
    if (!this.source || this.state.capturing)
      throw new Error("Connect a controller and wait for any active capture to finish.");
    this.recording = { label, start: performance.now(), reports: [] };
    this.state.capturing = true;
    this.state.captureResult = "Recording for 5 seconds. Hold the labeled state.";
    this.captureTimer = setTimeout(() => {
      void this.finishCapture("duration");
    }, 5000);
  }
  private async finishCapture(stopReason: string): Promise<void> {
    const recording = this.recording;
    if (!recording) return;
    this.recording = undefined;
    clearTimeout(this.captureTimer);
    try {
      const directory = join(this.directory, "captures");
      await mkdir(directory, { recursive: true });
      const filename = `${Date.now().toString()}-${recording.label}.json`;
      await writeFile(
        join(directory, filename),
        JSON.stringify(
          {
            schemaVersion: 1,
            label: recording.label,
            device: {
              vendorId: 0x054c,
              productId: 0x05c4,
              connectionType: this.state.name.includes("bluetooth") ? "bluetooth" : "unknown",
              reportDescriptorAvailable: false,
            },
            stopReason,
            reports: recording.reports,
          },
          null,
          2,
        ),
        { flag: "wx" },
      );
      this.state.captureResult = `Saved ${String(recording.reports.length)} reports: ${filename}`;
    } catch (error) {
      this.state.error = String(error);
    } finally {
      this.state.capturing = false;
    }
  }
  async loadMapping() {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(join(this.directory, "mapping.json"), "utf8"),
      );
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length === 12 &&
        Object.keys(parsed).every((key) => controls.slice(0, 12).some((control) => control === key))
      )
        return validateMapping({ ...defaultMapping, ...parsed });
      return validateMapping(parsed);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
        return { ...defaultMapping };
      throw error;
    }
  }
  async saveMapping(value: unknown): Promise<void> {
    const mapping = validateMapping(value);
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, `mapping-${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(mapping, null, 2), { flag: "wx" });
    await rename(temporary, join(this.directory, "mapping.json"));
    this.activeMapping = mapping;
  }
}

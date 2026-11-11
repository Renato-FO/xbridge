import HID from "node-hid";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { NodeHidDeviceProvider } from "../devices/node-hid-device-provider.js";
import {
  controls,
  defaultMapping,
  validateMapping,
  type ControllerState,
  type MonitorState,
} from "./contracts.js";
import { JoystickMonitor } from "../devices/joystick-monitor.js";
import { mapPreview, type JoystickInput } from "../devices/windows-joystick.js";
import { OutputClient } from "../virtual-controller/output-client.js";
import { toXboxReport } from "../virtual-controller/report.js";

export type VirtualOutput = Pick<
  OutputClient,
  "status" | "error" | "userIndex" | "setInput" | "start" | "stop"
>;
export class DesktopService {
  // One virtual Xbox controller per physical controller, keyed by Windows joystick ID.
  private readonly outputs = new Map<number, VirtualOutput>();
  private readonly retiring = new Set<Promise<void>>();
  private inputs: readonly JoystickInput[] = [];
  private activeMapping = { ...defaultMapping };
  private readonly joystick = new JoystickMonitor((inputs) => {
    this.route(inputs);
  });
  /** Feeds each controller's input to its own output; called on every monitor tick. */
  route(inputs: readonly JoystickInput[]) {
    this.inputs = inputs;
    const outputRunning = [...this.outputs.values()].some((output) => output.status !== "stopped");
    for (const [id, output] of this.outputs)
      if (!inputs.some((controller) => controller.id === id)) {
        this.outputs.delete(id);
        output.setInput(undefined);
        const stopped: Promise<void> = output.stop().finally(() => {
          this.retiring.delete(stopped);
        });
        this.retiring.add(stopped);
      }
    for (const { id, input } of inputs) {
      const report = toXboxReport(mapPreview(input, this.activeMapping));
      const existing = this.outputs.get(id);
      if (existing) {
        existing.setInput(report);
        continue;
      }
      const output = this.createOutput();
      this.outputs.set(id, output);
      output.setInput(report);
      // A controller connected while Xbox output is running joins automatically.
      if (outputRunning)
        output.start().catch(() => {
          // The failure is kept in output.error and shown for that controller.
        });
    }
  }
  async startOutput() {
    this.activeMapping = await this.loadMapping();
    this.route(this.joystick.inputs);
    if (this.outputs.size === 0)
      throw new Error("Wake and connect the physical controller before starting Xbox output.");
    const results = await Promise.allSettled(
      [...this.outputs.values()].map((output) => output.start()),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure && results.every((result) => result.status === "rejected"))
      throw failure.reason instanceof Error ? failure.reason : new Error(String(failure.reason));
  }
  async stopOutput() {
    await Promise.all([
      ...[...this.outputs.values()].map((output) => output.stop()),
      ...this.retiring,
    ]);
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
  constructor(
    private readonly directory: string,
    private readonly createOutput: () => VirtualOutput = () => new OutputClient(),
  ) {}
  snapshot(): MonitorState {
    const controllers: ControllerState[] = this.inputs.map(({ id, input }) => {
      const output = this.outputs.get(id);
      return {
        id,
        input,
        mappedInput: mapPreview(input, this.preview),
        outputStatus: output?.status ?? "stopped",
        outputError: output?.error ?? "",
        ...(output?.userIndex !== undefined ? { userIndex: output.userIndex } : {}),
      };
    });
    const statuses = controllers.map((controller) => controller.outputStatus);
    const first = controllers[0];
    return {
      ...this.state,
      bytes: [...this.state.bytes],
      controllers,
      input: first?.input ?? {},
      mappedInput: first?.mappedInput ?? mapPreview({}, this.preview),
      inputAvailable: first !== undefined,
      inputError: this.joystick.error,
      outputStatus: statuses.includes("active")
        ? "active"
        : statuses.includes("starting")
          ? "starting"
          : "stopped",
      outputError: controllers.find((controller) => controller.outputError)?.outputError ?? "",
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
      // Raw HID capture is a diagnostic of the first controller; live input covers all of them.
      const device = devices[0];
      if (!device?.path)
        throw new Error("Connect a 054C:05C4 controller and press PS, then retry.");
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
    await this.stopOutput();
    await this.joystick.stop();
    this.route([]);
    await Promise.all(this.retiring);
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

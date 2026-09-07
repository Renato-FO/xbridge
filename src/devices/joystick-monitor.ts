import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { decodeWindowsJoystick } from "./windows-joystick.js";
import type { ControlValues } from "../ui/contracts.js";
export class JoystickMonitor {
  constructor(private readonly onInput?: (input: ControlValues | undefined) => void) {}
  private child: ChildProcessWithoutNullStreams | undefined;
  input: ControlValues | undefined;
  error = "";
  start() {
    if (this.child) return;
    const executable = fileURLToPath(
      new URL("../../artifacts/native/XBridge.VirtualController.exe", import.meta.url),
    );
    const child = spawn(executable, ["--monitor-joystick"], { windowsHide: true, stdio: "pipe" });
    this.child = child;
    child.on("error", () => {
      this.error = "Live controller reader unavailable. Run npm run build:native.";
    });
    child.stderr.on("data", (data: Buffer) => {
      this.error = data.toString().slice(0, 500);
    });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        this.input = decodeWindowsJoystick(JSON.parse(line) as unknown);
        this.onInput?.(this.input);
        this.error = "";
      } catch (error) {
        this.input = undefined;
        this.onInput?.(undefined);
        this.error = String(error);
      }
    });
    child.on("close", () => {
      lines.close();
      this.child = undefined;
      this.input = undefined;
      this.onInput?.(undefined);
    });
  }
  async stop(): Promise<void> {
    const child = this.child;
    this.input = undefined;
    if (!child) return;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill();
      }, 1000);
      child.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });
      child.stdin.end("stop\n");
    });
  }
}

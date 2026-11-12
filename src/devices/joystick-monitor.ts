import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { nativeExecutable } from "../native/executable.js";
import { decodeWindowsJoysticks, type JoystickInput } from "./windows-joystick.js";
import type { ControlValues } from "../ui/contracts.js";
export class JoystickMonitor {
  constructor(private readonly onInput?: (inputs: readonly JoystickInput[]) => void) {}
  private child: ChildProcessWithoutNullStreams | undefined;
  /** Every connected controller, ordered by Windows joystick ID. */
  inputs: readonly JoystickInput[] = [];
  error = "";
  /** First connected controller, kept for single-controller callers. */
  get input(): ControlValues | undefined {
    return this.inputs[0]?.input;
  }
  private publish(inputs: readonly JoystickInput[]) {
    this.inputs = inputs;
    this.onInput?.(inputs);
  }
  start() {
    if (this.child) return;
    const executable = nativeExecutable("native");
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
        const inputs = decodeWindowsJoysticks(JSON.parse(line) as unknown).sort(
          (a, b) => a.id - b.id,
        );
        this.publish(inputs);
        this.error = "";
      } catch (error) {
        this.publish([]);
        this.error = String(error);
      }
    });
    child.on("close", () => {
      lines.close();
      this.child = undefined;
      this.publish([]);
    });
  }
  async stop(): Promise<void> {
    const child = this.child;
    this.inputs = [];
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

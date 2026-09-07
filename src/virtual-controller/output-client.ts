import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { XboxReport } from "./report.js";

export class OutputClient {
  status: "stopped" | "starting" | "active" = "stopped";
  error = "";
  userIndex: number | undefined;
  private stopping: Promise<void> | undefined;
  private child: ChildProcessWithoutNullStreams | undefined;
  private id = 0;
  private generation = 0;
  private requests = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();
  private ready: (() => void) | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private latest: XboxReport | undefined;
  private lastInput = 0;
  private sent = "";
  private lastSent = 0;
  private updating = false;
  constructor(private readonly fake = false) {}
  setInput(report: XboxReport | undefined) {
    this.latest = report;
    this.lastInput = performance.now();
    if (!report && this.status !== "stopped") {
      void this.stop();
      return;
    }
    this.pump();
  }
  async start(): Promise<void> {
    if (this.stopping) await this.stopping;
    if (this.status !== "stopped") return;
    if (!this.latest || performance.now() - this.lastInput > 500)
      throw new Error("Wake and connect the physical controller before starting Xbox output.");
    this.status = "starting";
    this.error = "";
    this.sent = "";
    const generation = ++this.generation;
    const executable = fileURLToPath(
      new URL("../../artifacts/native-output/XBridge.VirtualController.exe", import.meta.url),
    );
    const child = spawn(executable, [this.fake ? "--output-fake" : "--output"], {
      windowsHide: true,
      stdio: "pipe",
    });
    this.child = child;
    const ready = new Promise<void>((resolve) => {
      this.ready = resolve;
    });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        const message: unknown = JSON.parse(line);
        if (
          typeof message !== "object" ||
          message === null ||
          !("version" in message) ||
          message.version !== 1 ||
          !("type" in message)
        )
          throw new Error("Invalid native bridge response.");
        if (message.type === "ready") {
          this.ready?.();
          this.ready = undefined;
          return;
        }
        if (!("id" in message) || typeof message.id !== "number")
          throw new Error("Missing response ID.");
        const request = this.requests.get(message.id);
        if (message.type === "error") {
          const error = new Error(
            "message" in message && typeof message.message === "string"
              ? message.message
              : "Xbox output failed.",
          );
          if (request) request.reject(error);
          else this.fail(error.message);
        } else if (message.type === "ack" && request) {
          if (
            "userIndex" in message &&
            typeof message.userIndex === "number" &&
            Number.isInteger(message.userIndex) &&
            message.userIndex >= 0 &&
            message.userIndex < 4
          )
            this.userIndex = message.userIndex;
          request.resolve();
        } else throw new Error("Unexpected native response.");
      } catch (error) {
        this.fail(String(error));
      }
    });
    child.on("error", (error) => {
      this.fail(error.message);
    });
    child.stdin.on("error", (error) => {
      this.fail(error.message);
    });
    child.stderr.on("data", (data: Buffer) => {
      this.error = data.toString().slice(0, 500);
    });
    child.once("close", () => {
      lines.close();
      if (this.child === child) {
        this.child = undefined;
        this.fail(this.status === "stopped" ? "" : "Xbox bridge closed unexpectedly.");
      }
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        ready,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error("Xbox bridge did not start."));
          }, 3000);
        }),
      ]);
      if (generation !== this.generation) return;
      await this.request("start");
      if (generation !== this.generation) return;
      this.status = "active";
      this.timer = setInterval(() => {
        this.pump();
      }, 125);
      this.pump();
    } catch (error) {
      this.fail(String(error));
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  private request(type: string, report?: XboxReport): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = this.child;
      if (!child || child.stdin.destroyed) {
        reject(new Error("Xbox bridge is unavailable."));
        return;
      }
      const id = ++this.id;
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        this.requests.delete(id);
        if (error) reject(error);
        else resolve();
      };
      const timeout = setTimeout(() => {
        finish(new Error("Xbox bridge response timed out."));
      }, 2000);
      this.requests.set(id, {
        resolve: () => {
          finish();
        },
        reject: (error) => {
          finish(error);
        },
      });
      child.stdin.write(
        JSON.stringify({ version: 1, id, type, ...(report ? { report } : {}) }) + "\n",
      );
    });
  }
  private pump() {
    if (this.status !== "active" || this.updating) return;
    if (!this.latest || performance.now() - this.lastInput > 500) {
      void this.stop();
      return;
    }
    const serialized = JSON.stringify(this.latest);
    if (serialized === this.sent && performance.now() - this.lastSent < 150) return;
    this.updating = true;
    void this.request("update", this.latest)
      .then(() => {
        this.sent = serialized;
        this.lastSent = performance.now();
      })
      .catch((error: unknown) => {
        this.fail(String(error));
      })
      .finally(() => {
        this.updating = false;
      });
  }
  private fail(message: string) {
    if (message) this.error = message;
    this.status = "stopped";
    clearInterval(this.timer);
    for (const request of this.requests.values())
      request.reject(new Error(message || "Xbox output stopped."));
    this.requests.clear();
    this.child?.stdin.end();
  }
  stop(): Promise<void> {
    this.stopping ??= this.close().finally(() => {
      this.stopping = undefined;
    });
    return this.stopping;
  }
  private async close(): Promise<void> {
    this.generation++;
    this.status = "stopped";
    clearInterval(this.timer);
    const child = this.child;
    if (!child) return;
    try {
      await this.request("shutdown");
    } catch (error) {
      this.error = String(error);
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            child.kill();
          }, 1000);
          child.once("close", () => {
            clearTimeout(timer);
            resolve();
          });
          child.stdin.end();
        });
      if (this.child === child) this.child = undefined;
    }
  }
}

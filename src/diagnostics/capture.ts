import { performance } from "node:perf_hooks";
import type { HidDeviceDescriptor } from "../devices/hid-device.js";

export interface InputSource {
  on(event: "data", listener: (report: Buffer) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  removeAllListeners(event: string): unknown;
  close(): Promise<void>;
}

// Bounds apply to memory as well as the resulting JSON artifact.
export async function captureReports(
  source: InputSource,
  device: HidDeviceDescriptor,
  label: string,
  durationMs: number,
  signal?: AbortSignal,
  maxReports = 2000,
) {
  try {
    if (
      !Number.isInteger(durationMs) ||
      durationMs < 1 ||
      durationMs > 60000 ||
      !Number.isInteger(maxReports) ||
      maxReports < 1 ||
      maxReports > 10000 ||
      !/^[a-z0-9-]{1,64}$/.test(label)
    ) {
      throw new Error("Invalid capture limits or label.");
    }
    const reports: { elapsedMs: number; hex: string }[] = [];
    const started = performance.now();
    const stopReason = await new Promise<string>((resolve, reject) => {
      const finish = (reason: string) => {
        cleanup();
        resolve(reason);
      };
      const abort = () => {
        finish("cancelled");
      };
      const timer = setTimeout(() => {
        finish("duration");
      }, durationMs);
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        source.removeAllListeners("data");
        source.removeAllListeners("error");
      };
      source.on("error", (error) => {
        cleanup();
        reject(error);
      });
      source.on("data", (report) => {
        if (report.length === 0 || report.length > 4096) {
          cleanup();
          reject(new Error("Invalid HID report length."));
          return;
        }
        reports.push({ elapsedMs: performance.now() - started, hex: report.toString("hex") });
        if (reports.length >= maxReports) finish("report-limit");
      });
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
    return {
      schemaVersion: 1,
      label,
      device: {
        vendorId: device.vendorId,
        productId: device.productId,
        connectionType: device.connectionType,
        reportDescriptorAvailable: device.reportDescriptorAvailable,
        usagePage: device.usagePage,
        usage: device.usage,
      },
      stopReason,
      reports,
    };
  } finally {
    await source.close();
  }
}

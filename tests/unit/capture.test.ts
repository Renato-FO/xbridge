import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { captureReports } from "../../src/diagnostics/capture.js";

class Source extends EventEmitter {
  closed = false;
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}
const device = {
  vendorId: 1356,
  productId: 1476,
  connectionType: "bluetooth" as const,
  reportDescriptorAvailable: false,
  path: "private-path",
  serialNumber: "private-serial",
};

describe("captureReports", () => {
  it("bounds reports, excludes stable identifiers, and closes the source", async () => {
    const source = new Source();
    const result = captureReports(source, device, "unlabeled", 1000, undefined, 1);
    source.emit("data", Buffer.from([1, 128, 0]));
    const capture = await result;
    expect(capture.reports[0]?.hex).toBe("018000");
    expect(capture.stopReason).toBe("report-limit");
    expect(JSON.stringify(capture)).not.toContain("private-");
    expect(source.closed).toBe(true);
    expect(source.listenerCount("data")).toBe(0);
  });
  it("handles disconnect/read failure and closes", async () => {
    const source = new Source();
    const result = captureReports(source, device, "unlabeled", 1000);
    source.emit("error", new Error("removed"));
    await expect(result).rejects.toThrow("removed");
    expect(source.closed).toBe(true);
  });
  it("stops on cancellation", async () => {
    const source = new Source();
    const controller = new AbortController();
    const result = captureReports(source, device, "unlabeled", 1000, controller.signal);
    controller.abort();
    expect((await result).stopReason).toBe("cancelled");
    expect(source.closed).toBe(true);
  });
  it("rejects oversized input", async () => {
    const source = new Source();
    const result = captureReports(source, device, "unlabeled", 1000);
    source.emit("data", Buffer.alloc(4097));
    await expect(result).rejects.toThrow("Invalid HID report length");
    expect(source.closed).toBe(true);
  });
  it("stops an idle device at the deadline", async () => {
    const source = new Source();
    expect((await captureReports(source, device, "unlabeled", 1)).stopReason).toBe("duration");
    expect(source.closed).toBe(true);
  });
});

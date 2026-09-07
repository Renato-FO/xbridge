import { describe, expect, it } from "vitest";

import type { HidDeviceDescriptor } from "../../src/devices/hid-device.js";
import { formatDeviceList } from "../../src/diagnostics/format-device-list.js";

describe("formatDeviceList", () => {
  it("formats known fields and labels unavailable metadata honestly", () => {
    const device: HidDeviceDescriptor = {
      vendorId: 0x054c,
      productId: 0x09cc,
      product: "Test controller",
      usagePage: 1,
      usage: 5,
      reportDescriptorAvailable: false,
      connectionType: "unknown",
    };

    const result = formatDeviceList([device]);

    expect(result).toContain("VID: 0x054C  PID: 0x09CC");
    expect(result).toContain("Test controller");
    expect(result).toContain("Input report bytes: unavailable");
    expect(result).toContain("Report descriptor: unavailable");
  });

  it("handles an empty device list", () => {
    expect(formatDeviceList([])).toBe("No HID devices found.");
  });
});

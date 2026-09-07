import { describe, expect, it } from "vitest";

import { XBridgeError } from "../../src/application/errors.js";
import { NodeHidDeviceProvider } from "../../src/devices/node-hid-device-provider.js";

describe("NodeHidDeviceProvider", () => {
  it("maps node-hid data without inventing unavailable descriptor metadata", async () => {
    const provider = new NodeHidDeviceProvider(() =>
      Promise.resolve([
        {
          vendorId: 0x1234,
          productId: 0x5678,
          path: "USB\\VID_1234&PID_5678",
          product: "Fixture controller",
          manufacturer: undefined,
          serialNumber: undefined,
          release: 256,
          interface: 1,
          usagePage: 1,
          usage: 5,
        },
      ]),
    );

    await expect(provider.listDevices()).resolves.toEqual([
      {
        vendorId: 0x1234,
        productId: 0x5678,
        path: "USB\\VID_1234&PID_5678",
        product: "Fixture controller",
        releaseNumber: 256,
        interfaceNumber: 1,
        usagePage: 1,
        usage: 5,
        reportDescriptorAvailable: false,
        connectionType: "usb",
      },
    ]);
  });

  it("wraps enumeration failures in a structured error", async () => {
    const provider = new NodeHidDeviceProvider(() => Promise.reject(new Error("fixture failure")));

    await expect(provider.listDevices()).rejects.toMatchObject({
      code: "HID_ENUMERATION_FAILED",
      technicalDetail: "fixture failure",
    } satisfies Partial<XBridgeError>);
  });
});

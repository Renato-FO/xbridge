import HID from "node-hid";

import { XBridgeError } from "../application/errors.js";
import { inferConnectionType } from "./connection-type.js";
import type { HidDeviceDescriptor, HidDeviceProvider } from "./hid-device.js";

export interface NodeHidDeviceData {
  readonly vendorId: number;
  readonly productId: number;
  readonly path?: string | undefined;
  readonly serialNumber?: string | undefined;
  readonly manufacturer?: string | undefined;
  readonly product?: string | undefined;
  readonly release: number;
  readonly interface: number;
  readonly usagePage?: number | undefined;
  readonly usage?: number | undefined;
}

export type NodeHidEnumerator = () => Promise<readonly NodeHidDeviceData[]>;

export class NodeHidDeviceProvider implements HidDeviceProvider {
  public constructor(private readonly enumerate: NodeHidEnumerator = () => HID.devicesAsync()) {}

  public async listDevices(): Promise<readonly HidDeviceDescriptor[]> {
    try {
      const devices = await this.enumerate();
      return devices.map((device) => {
        const descriptor: HidDeviceDescriptor = {
          vendorId: device.vendorId,
          productId: device.productId,
          reportDescriptorAvailable: false,
          connectionType: inferConnectionType(device.path),
        };

        return {
          ...descriptor,
          releaseNumber: device.release,
          interfaceNumber: device.interface,
          ...(device.path === undefined ? {} : { path: device.path }),
          ...(device.product === undefined ? {} : { product: device.product }),
          ...(device.manufacturer === undefined ? {} : { manufacturer: device.manufacturer }),
          ...(device.serialNumber === undefined ? {} : { serialNumber: device.serialNumber }),
          ...(device.usagePage === undefined ? {} : { usagePage: device.usagePage }),
          ...(device.usage === undefined ? {} : { usage: device.usage }),
        };
      });
    } catch (error: unknown) {
      throw new XBridgeError({
        code: "HID_ENUMERATION_FAILED",
        technicalDetail: error instanceof Error ? error.message : String(error),
        userMessage: "XBridge could not enumerate HID devices.",
        cause: error,
      });
    }
  }
}

export type HidConnectionType = "usb" | "bluetooth" | "unknown";

export interface HidDeviceDescriptor {
  readonly path?: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly product?: string;
  readonly manufacturer?: string;
  readonly serialNumber?: string;
  readonly releaseNumber?: number;
  readonly interfaceNumber?: number;
  readonly usagePage?: number;
  readonly usage?: number;
  readonly inputReportByteLength?: number;
  readonly outputReportByteLength?: number;
  readonly featureReportByteLength?: number;
  readonly reportDescriptorAvailable: boolean;
  readonly connectionType: HidConnectionType;
}

export interface HidDeviceProvider {
  listDevices(): Promise<readonly HidDeviceDescriptor[]>;
}

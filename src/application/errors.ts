export type XBridgeErrorCode = "HID_ENUMERATION_FAILED" | "INVALID_ARGUMENT" | "UNEXPECTED_ERROR";

export interface XBridgeErrorOptions {
  readonly code: XBridgeErrorCode;
  readonly technicalDetail: string;
  readonly userMessage: string;
  readonly cause?: unknown;
}

export class XBridgeError extends Error {
  public readonly code: XBridgeErrorCode;
  public readonly technicalDetail: string;
  public readonly userMessage: string;

  public constructor(options: XBridgeErrorOptions) {
    super(options.userMessage, { cause: options.cause });
    this.name = "XBridgeError";
    this.code = options.code;
    this.technicalDetail = options.technicalDetail;
    this.userMessage = options.userMessage;
  }
}

export function toXBridgeError(error: unknown): XBridgeError {
  if (error instanceof XBridgeError) {
    return error;
  }

  return new XBridgeError({
    code: "UNEXPECTED_ERROR",
    technicalDetail: error instanceof Error ? error.message : String(error),
    userMessage: "XBridge encountered an unexpected error.",
    cause: error,
  });
}

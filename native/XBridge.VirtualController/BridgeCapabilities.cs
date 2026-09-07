namespace XBridge.VirtualController;

public sealed record BridgeCapabilities(
    int ProtocolVersion,
    string Architecture,
    bool VirtualControllerAvailable,
    string Backend)
{
    public static BridgeCapabilities Current { get; } = new(
        ProtocolVersion: 1,
        Architecture: "x64",
        VirtualControllerAvailable: false,
        Backend: "none");
}


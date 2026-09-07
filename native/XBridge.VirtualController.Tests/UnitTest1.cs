namespace XBridge.VirtualController.Tests;

public sealed class BridgeCapabilitiesTests
{
    [Fact]
    public void ScaffoldReportsNoVirtualBackend()
    {
        BridgeCapabilities capabilities = BridgeCapabilities.Current;

        Assert.Equal(1, capabilities.ProtocolVersion);
        Assert.Equal("x64", capabilities.Architecture);
        Assert.False(capabilities.VirtualControllerAvailable);
        Assert.Equal("none", capabilities.Backend);
    }
}

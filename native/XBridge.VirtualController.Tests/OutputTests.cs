using System.Text.Json;
namespace XBridge.VirtualController.Tests;
public sealed class OutputTests
{
    [Fact]
    public void ParsesContractAndUpdatesDriverNeutralBackend()
    {
        using var json = JsonDocument.Parse("""{"report":{"buttons":4096,"lt":255,"rt":0,"lx":-32768,"ly":32767,"rx":0,"ry":0}}""");
        using var backend = new FakeOutput();
        backend.Update(OutputHost.ReadReport(json.RootElement));
        Assert.Equal(new XboxReport(4096, 255, 0, -32768, 32767, 0, 0), backend.LastReport);
        backend.Dispose(); backend.Dispose();
        Assert.Throws<ObjectDisposedException>(() => backend.Update(new(0, 0, 0, 0, 0, 0, 0)));
    }
    [Fact]
    public void RejectsOutOfRangeWireValues()
    {
        using var json = JsonDocument.Parse("""{"report":{"buttons":999999,"lt":255,"rt":0,"lx":0,"ly":0,"rx":0,"ry":0}}""");
        Assert.Throws<FormatException>(() => OutputHost.ReadReport(json.RootElement));
    }
}

using Nefarius.ViGEm.Client;
using Nefarius.ViGEm.Client.Targets;
using Nefarius.ViGEm.Client.Targets.Xbox360;

namespace XBridge.VirtualController;

public sealed record XboxReport(ushort Buttons, byte LT, byte RT, short LX, short LY, short RX, short RY);
public interface IVirtualOutput : IDisposable
{
    void Update(XboxReport report);
}
public sealed class FakeOutput : IVirtualOutput
{
    public XboxReport? LastReport { get; private set; }
    public bool Disposed { get; private set; }
    public void Update(XboxReport report) { if (Disposed) throw new ObjectDisposedException(nameof(FakeOutput)); LastReport = report; }
    public void Dispose() { Disposed = true; }
}
public sealed class ViGEmOutput : IVirtualOutput
{
    private readonly ViGEmClient client;
    private readonly IXbox360Controller target;
    private bool disposed;
    public int? UserIndex
    {
        get
        {
            try { return target.UserIndex; }
            catch (Nefarius.ViGEm.Client.Targets.Xbox360.Exceptions.Xbox360UserIndexNotReportedException) { return null; }
        }
    }
    public ViGEmOutput()
    {
        client = new ViGEmClient();
        try { target = client.CreateXbox360Controller(); target.AutoSubmitReport = false; target.Connect(); }
        catch { client.Dispose(); throw; }
    }
    public void Update(XboxReport report)
    {
        target.SetButtonsFull(report.Buttons);
        target.SetSliderValue(Xbox360Slider.LeftTrigger, report.LT);
        target.SetSliderValue(Xbox360Slider.RightTrigger, report.RT);
        target.SetAxisValue(Xbox360Axis.LeftThumbX, report.LX);
        target.SetAxisValue(Xbox360Axis.LeftThumbY, report.LY);
        target.SetAxisValue(Xbox360Axis.RightThumbX, report.RX);
        target.SetAxisValue(Xbox360Axis.RightThumbY, report.RY);
        target.SubmitReport();
    }
    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        try { target.Disconnect(); } finally { client.Dispose(); }
    }
}

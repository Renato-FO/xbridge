using System.Runtime.InteropServices;
using System.Text.Json;
namespace XBridge.VirtualController;
public static class XInputProbe
{
    [StructLayout(LayoutKind.Sequential)]
    public struct State { public uint Packet; public ushort Buttons; public byte LT, RT; public short LX, LY, RX, RY; }
    [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")]
    private static extern uint GetState(uint index, out State state);
    public static void Print()
    {
        var states = new List<object>();
        for (uint index = 0; index < 4; index++) if (GetState(index, out var state) == 0) states.Add(new { index, buttons = state.Buttons, lt = state.LT, rt = state.RT, lx = state.LX, ly = state.LY, rx = state.RX, ry = state.RY });
        Console.WriteLine(JsonSerializer.Serialize(states));
    }
}

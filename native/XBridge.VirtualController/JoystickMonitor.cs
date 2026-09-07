using System.Runtime.InteropServices;
using System.Text.Json;

namespace XBridge.VirtualController;

// Windows' joystick API supplies decoded HID controls; no device report offsets are assumed.
internal static class JoystickMonitor
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Caps
    {
        public ushort Mid, Pid;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Name;
        public uint XMin, XMax, YMin, YMax, ZMin, ZMax, Buttons, PeriodMin, PeriodMax;
        public uint RMin, RMax, UMin, UMax, VMin, VMax, Flags, MaxAxes, Axes, MaxButtons;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string RegistryKey;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string Oem;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct Position
    {
        public uint Size, Flags, X, Y, Z, R, U, V, Buttons, ButtonNumber, Pov, Reserved1, Reserved2;
    }
    [DllImport("winmm.dll", EntryPoint = "joyGetDevCapsW", CharSet = CharSet.Unicode)]
    private static extern uint GetCaps(nuint id, out Caps caps, uint size);
    [DllImport("winmm.dll", EntryPoint = "joyGetPosEx")]
    private static extern uint GetPosition(uint id, ref Position position);

    public static async Task<int> Run()
    {
        if (!OperatingSystem.IsWindows()) return 2;
        using var cancellation = new CancellationTokenSource();
        _ = Task.Run(async () => { await Console.In.ReadLineAsync(); cancellation.Cancel(); });
        while (!cancellation.IsCancellationRequested)
        {
            var found = false;
            for (uint id = 0; id < 16; id++)
            {
                if (GetCaps(id, out var caps, (uint)Marshal.SizeOf<Caps>()) != 0 || caps.Mid != 0x054c || caps.Pid != 0x05c4) continue;
                var position = new Position { Size = (uint)Marshal.SizeOf<Position>(), Flags = 0xff };
                if (GetPosition(id, ref position) != 0) continue;
                double Axis(uint value, uint min, uint max) => max > min ? Math.Clamp((double)(value - (double)min) / (max - min), 0, 1) : 0.5;
                Console.WriteLine(JsonSerializer.Serialize(new { connected = true, buttons = position.Buttons, pov = position.Pov,
                    axes = new[] { Axis(position.X, caps.XMin, caps.XMax), Axis(position.Y, caps.YMin, caps.YMax),
                        Axis(position.Z, caps.ZMin, caps.ZMax), Axis(position.R, caps.RMin, caps.RMax),
                        Axis(position.U, caps.UMin, caps.UMax), Axis(position.V, caps.VMin, caps.VMax) } }));
                found = true;
                break;
            }
            if (!found) Console.WriteLine("{\"connected\":false}");
            try { await Task.Delay(found ? 16 : 1000, cancellation.Token); }
            catch (OperationCanceledException) { break; }
        }
        return 0;
    }
}

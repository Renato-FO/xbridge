using System.Text.Json;
using XBridge.VirtualController;

if (args is ["--monitor-joystick"]) return await JoystickMonitor.Run();
if (args is ["--output"]) return await OutputHost.Run(false);
if (args is ["--output-fake"]) return await OutputHost.Run(true);
if (args is ["--xinput-state"]) { XInputProbe.Print(); return 0; }

if (args is ["--probe"])
{
    Console.WriteLine(JsonSerializer.Serialize(BridgeCapabilities.Current));
    return 0;
}

Console.Error.WriteLine("XBridge native bridge scaffold: use --probe to inspect capabilities.");
return 2;

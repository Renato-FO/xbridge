using System.Text.Json;

namespace XBridge.VirtualController;

public static class OutputHost
{
    public static XboxReport ReadReport(JsonElement root)
    {
        var r = root.GetProperty("report");
        return new(r.GetProperty("buttons").GetUInt16(), r.GetProperty("lt").GetByte(), r.GetProperty("rt").GetByte(),
            r.GetProperty("lx").GetInt16(), r.GetProperty("ly").GetInt16(), r.GetProperty("rx").GetInt16(), r.GetProperty("ry").GetInt16());
    }
    public static async Task<int> Run(bool fake)
    {
        IVirtualOutput? output = null;
        void Send(object message) => Console.WriteLine(JsonSerializer.Serialize(message));
        Send(new { version = 1, type = "ready", backend = fake ? "fake" : "vigem" });
        using var input = new StreamReader(Console.OpenStandardInput());
        var pendingRead = input.ReadLineAsync();
        try
        {
            while (true)
            {
                // A stalled or dead parent must never leave buttons held in a game.
                if (output is not null && await Task.WhenAny(pendingRead, Task.Delay(1000)) != pendingRead)
                {
                    output.Dispose(); output = null;
                    Send(new { version = 1, id = 0, type = "error", message = "Xbox output stopped: input heartbeat timed out." });
                }
                var line = await pendingRead;
                if (line is null) break;
                pendingRead = input.ReadLineAsync();
                var id = 0;
                try
                {
                    if (line.Length > 4096) throw new InvalidOperationException("Command too large.");
                    using var document = JsonDocument.Parse(line);
                    var root = document.RootElement;
                    id = root.GetProperty("id").GetInt32();
                    if (id <= 0 || root.GetProperty("version").GetInt32() != 1) throw new InvalidOperationException("Invalid protocol version or request ID.");
                    var type = root.GetProperty("type").GetString();
                    switch (type)
                    {
                        case "start": output ??= fake ? new FakeOutput() : new ViGEmOutput(); break;
                        case "update":
                            if (output is null) throw new InvalidOperationException("Xbox output is not connected.");
                            output.Update(ReadReport(root)); break;
                        case "shutdown":
                            output?.Dispose(); output = null;
                            Send(new { version = 1, id, type = "ack" }); return 0;
                        default: throw new InvalidOperationException("Unknown bridge command.");
                    }
                    Send(new { version = 1, id, type = "ack", userIndex = output is ViGEmOutput real ? (int?)real.UserIndex : null });
                }
                catch (Exception error)
                {
                    output?.Dispose(); output = null;
                    Send(new { version = 1, id, type = "error", message = error.Message });
                }
            }
        }
        finally { output?.Dispose(); }
        return 0;
    }
}

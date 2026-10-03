# DPI-aware click at DF client pixel coordinates.
param([Parameter(Mandatory)][int]$X, [Parameter(Mandatory)][int]$Y, [int]$HoldMs = 120)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Drawing;
public class DFC {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref Point p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, UIntPtr e);
}
"@
[void][DFC]::SetProcessDPIAware()
$h = (Get-Process 'Dwarf Fortress' -ErrorAction Stop | Sort-Object StartTime | Select-Object -First 1).MainWindowHandle
[void][DFC]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 200
$tl = New-Object System.Drawing.Point(0, 0)
[void][DFC]::ClientToScreen($h, [ref]$tl)
[void][DFC]::SetCursorPos(($tl.X + $X), ($tl.Y + $Y))
Start-Sleep -Milliseconds 350
[DFC]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds $HoldMs
[DFC]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
Write-Output "clicked client $X,$Y"

# DPI-aware client-area screenshot of Dwarf Fortress.
# The old grab.ps1 ran DPI-unaware, so on this 150%-scaled screen a 2560x1369 window
# came back as 1706x912 (downscaled, tiles no longer 16 px). This one sees real pixels.
param([Parameter(Mandatory)][string]$OutFile, [switch]$NoFocus)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Drawing;
public class DFG {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref Point p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
[void][DFG]::SetProcessDPIAware()
$h = (Get-Process 'Dwarf Fortress' -ErrorAction Stop | Sort-Object StartTime | Select-Object -First 1).MainWindowHandle
if (-not $NoFocus) { [void][DFG]::SetForegroundWindow($h); Start-Sleep -Milliseconds 120 }
$c = New-Object DFG+RECT
[void][DFG]::GetClientRect($h, [ref]$c)
$tl = New-Object System.Drawing.Point(0, 0)
[void][DFG]::ClientToScreen($h, [ref]$tl)
$w = $c.Right - $c.Left; $ht = $c.Bottom - $c.Top
$bmp = New-Object System.Drawing.Bitmap($w, $ht)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($tl.X, $tl.Y, 0, 0, (New-Object System.Drawing.Size($w, $ht)))
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved $OutFile (${w}x${ht})"

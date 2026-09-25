param(
    [Parameter(Mandatory = $true)][string]$OutFile
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
public class DFWin {
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string cls, string title);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref Point p);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

$proc = Get-Process -Name "Dwarf Fortress" -ErrorAction Stop | Sort-Object StartTime | Select-Object -First 1
$hwnd = $proc.MainWindowHandle
[void][DFWin]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 150

$client = New-Object DFWin+RECT
[void][DFWin]::GetClientRect($hwnd, [ref]$client)

$topLeft = New-Object System.Drawing.Point(0, 0)
[void][DFWin]::ClientToScreen($hwnd, [ref]$topLeft)

$width = $client.Right - $client.Left
$height = $client.Bottom - $client.Top

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($topLeft.X, $topLeft.Y, 0, 0, (New-Object System.Drawing.Size($width, $height)))
$bitmap.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "saved ${OutFile} (${width}x${height})"

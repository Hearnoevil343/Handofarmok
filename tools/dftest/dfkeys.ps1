# Helpers for driving Dwarf Fortress: dot-source this (. .\dfkeys.ps1).
#   Show-DF            maximise, make topmost (so the Claude window cannot cover it), focus
#   Send-DFKey 'd' 5   press d five times (-Shift for shift+d); DF drops keys sent too fast
#   Grab-DF file.png   client-area screenshot (same as grab.ps1)
#   Wait-DFStill 6     wait until the screen has not changed for 6 s (DF lags seconds behind input)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
public class DFK {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, int data, UIntPtr extra);
    [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint code, uint type);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref Point p);
}
"@

function Get-DFHandle {
    $p = Get-Process -Name 'Dwarf Fortress' -ErrorAction Stop | Sort-Object StartTime | Select-Object -First 1
    return $p.MainWindowHandle
}

function Show-DF {
    $h = Get-DFHandle
    [void][DFK]::ShowWindowAsync($h, 3)
    # HWND_TOPMOST = -1; SWP_NOMOVE|SWP_NOSIZE = 3
    [void][DFK]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 3)
    [void][DFK]::SetForegroundWindow($h)
    Start-Sleep -Milliseconds 400
}

function Hide-DFTopmost {
    # HWND_NOTOPMOST = -2
    [void][DFK]::SetWindowPos((Get-DFHandle), [IntPtr](-2), 0, 0, 0, 0, 3)
}

$script:VK = @{ enter = 0x0D; escape = 0x1B; space = 0x20; up = 0x26; down = 0x28; left = 0x25; right = 0x27; tab = 0x09 }

function Send-DFKey {
    param([Parameter(Mandatory)][string]$Key, [int]$Count = 1, [switch]$Shift, [int]$HoldMs = 60, [int]$GapMs = 120)
    $k = $Key.ToLower()
    $vk = if ($script:VK.ContainsKey($k)) { $script:VK[$k] } else { [int][char]$k.ToUpper() }
    $sc = [byte][DFK]::MapVirtualKey($vk, 0)
    # SDL ignores virtual-key events; it needs KEYEVENTF_SCANCODE (8). Arrows are extended keys (1).
    $ext = if ($vk -ge 0x25 -and $vk -le 0x28) { 1 } else { 0 }
    for ($i = 0; $i -lt $Count; $i++) {
        if ($Shift) { [DFK]::keybd_event(0, 0x2A, 8, [UIntPtr]::Zero) }
        [DFK]::keybd_event(0, $sc, (8 -bor $ext), [UIntPtr]::Zero)
        Start-Sleep -Milliseconds $HoldMs
        [DFK]::keybd_event(0, $sc, (10 -bor $ext), [UIntPtr]::Zero)
        if ($Shift) { [DFK]::keybd_event(0, 0x2A, 10, [UIntPtr]::Zero) }
        Start-Sleep -Milliseconds $GapMs
    }
}

# Click at client coordinates (DF ignores instant clicks: hold 150 ms; it also wants a hover first).
function Click-DF {
    param([int]$X, [int]$Y)
    $h = Get-DFHandle
    $tl = New-Object System.Drawing.Point(0, 0)
    [void][DFK]::ClientToScreen($h, [ref]$tl)
    [void][DFK]::SetCursorPos($tl.X + $X, $tl.Y + $Y)
    Start-Sleep -Milliseconds 400
    [DFK]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 150
    [DFK]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
}

function Grab-DF {
    param([Parameter(Mandatory)][string]$OutFile)
    $h = Get-DFHandle
    $c = New-Object DFK+RECT
    [void][DFK]::GetClientRect($h, [ref]$c)
    $tl = New-Object System.Drawing.Point(0, 0)
    [void][DFK]::ClientToScreen($h, [ref]$tl)
    $w = $c.Right - $c.Left; $ht = $c.Bottom - $c.Top
    $bmp = New-Object System.Drawing.Bitmap($w, $ht)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($tl.X, $tl.Y, 0, 0, (New-Object System.Drawing.Size($w, $ht)))
    $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

# Mean absolute difference of two small greyscale thumbnails, 0..255.
function Get-Thumb([string]$file) {
    $img = [System.Drawing.Image]::FromFile($file)
    $t = New-Object System.Drawing.Bitmap($img, 64, 36)
    $img.Dispose()
    $v = New-Object 'int[]' (64 * 36)
    for ($y = 0; $y -lt 36; $y++) { for ($x = 0; $x -lt 64; $x++) {
        $p = $t.GetPixel($x, $y); $v[$y * 64 + $x] = [int](($p.R + $p.G + $p.B) / 3) } }
    $t.Dispose()
    return , $v
}

function Wait-DFStill {
    param([int]$StillSec = 6, [int]$MaxSec = 120, [string]$Tmp = "$env:TEMP\dfstill.png")
    $prev = $null; $stillSince = $null; $t0 = Get-Date
    while (((Get-Date) - $t0).TotalSeconds -lt $MaxSec) {
        Grab-DF $Tmp
        $cur = Get-Thumb $Tmp
        if ($prev) {
            $d = 0; for ($i = 0; $i -lt $cur.Length; $i++) { $d += [math]::Abs($cur[$i] - $prev[$i]) }
            $d = $d / $cur.Length
            if ($d -lt 0.5) { if (-not $stillSince) { $stillSince = Get-Date } }
            else { $stillSince = $null }
            if ($stillSince -and ((Get-Date) - $stillSince).TotalSeconds -ge $StillSec) { return $true }
        }
        $prev = $cur
        Start-Sleep -Milliseconds 700
    }
    return $false
}



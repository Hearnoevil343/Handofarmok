Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W2{[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);}'
$h = (Get-Process 'Dwarf Fortress' | Sort-Object StartTime)[0].MainWindowHandle
[W2]::ShowWindowAsync($h, 3)
Start-Sleep -Milliseconds 200
[W2]::SetForegroundWindow($h)

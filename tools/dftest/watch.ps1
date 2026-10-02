param([int]$Seconds = 130, [string]$Name = "hoa-britannia")
$dir = "$env:TEMP\$Name\raw"
New-Item -ItemType Directory -Force $dir | Out-Null
$end = (Get-Date).AddSeconds($Seconds)
$i = 0
while ((Get-Date) -lt $end) {
    & 'E:\dev\hand-of-armok\tools\dftest\grab.ps1' -OutFile ("$dir\f{0:000}.png" -f $i) | Out-Null
    $i++
    Start-Sleep -Milliseconds 400
}
"done $i"

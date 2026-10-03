# Generate a world in Dwarf Fortress headlessly and save its map as a PNG.
#
#   powershell -ExecutionPolicy Bypass -File tools/dftest/genmap.ps1 SKYRIM
#   powershell -ExecutionPolicy Bypass -File tools/dftest/genmap.ps1 SKYRIM,MORROWIND -Seed 433
#
# For each preset TITLE in prefs\world_gen.txt: picks the first free save slot, runs
# `Dwarf Fortress.exe -gen <slot> <seed> <TITLE>`, waits for history to reach the preset's
# END_YEAR, then converts DF's own export (`region<N>-<year>-01-01-detailed.bmp`, 16 px per
# tile) to screenshots/df-maps/<name>.png at -Size px. Needs python with Pillow.
#
# Known: DF sometimes crashes in the export step after history is done; the world is fine
# but the BMP is missing. Rerun or capture in the UI. Close other DF instances first.
param(
  [Parameter(Mandatory)][string[]]$Titles,
  [int]$Seed = 433,
  [int]$Size = 2056,
  [int]$TimeoutMin = 40,
  [string]$OutDir
)
# $PSScriptRoot is empty inside a param default on Windows PowerShell 5.1, so resolve it here.
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot '..\..\screenshots\df-maps' }
$df = 'E:\SteamLibrary\steamapps\common\Dwarf Fortress'
$saves = "$env:APPDATA\Bay 12 Games\Dwarf Fortress\save"
$prefs = "$env:APPDATA\Bay 12 Games\Dwarf Fortress\prefs\world_gen.txt"
$rej = "$df\map_rejection_log.txt"
New-Item -ItemType Directory -Force $OutDir | Out-Null

if (Get-Process -Name 'Dwarf Fortress' -ErrorAction SilentlyContinue) {
  throw 'A Dwarf Fortress instance is already running; close it first.'
}

function Get-EndYear([string]$title) {
  $lines = Get-Content $prefs
  $i = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match "^\s*\[TITLE:$title\]" } | Select-Object -First 1))
  if ($i -lt 0) { throw "Preset $title not found in $prefs" }
  for ($j = $i; $j -lt $lines.Count -and $j -lt $i + 40; $j++) {
    if ($lines[$j] -match '^\s*\[END_YEAR:(\d+)\]') { return [int]$Matches[1] }
  }
  throw "No END_YEAR after [TITLE:$title]"
}

function Get-FreeSlot {
  $n = 1
  while ((Test-Path "$saves\region$n") -or (Test-Path "$saves\region$n.zip")) { $n++ }
  return $n
}

foreach ($title in $Titles) {
  $name = $title.ToLower().Replace('_', '-')
  $endYear = Get-EndYear $title
  $slot = Get-FreeSlot
  $save = "$saves\region$slot"
  $bmp = "$df\region$slot-{0:D5}-01-01-detailed.bmp" -f $endYear
  $base = (Get-Content $rej -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
  $start = Get-Date
  Write-Host "$title -> slot $slot, seed $Seed, end year $endYear"
  $p = Start-Process "$df\Dwarf Fortress.exe" -ArgumentList "-gen $slot $Seed $title" -WorkingDirectory $df -PassThru
  $status = 'TIMEOUT'
  while ($true) {
    Start-Sleep 5
    $new = @(Get-Content $rej -ErrorAction SilentlyContinue | Select-Object -Skip $base | Where-Object { $_ -match "region$slot\b" })
    if ($new.Count -gt 0) { $status = "REJECTED: $($new[0])"; break }
    if ((Test-Path "$save\region_snapshot-$endYear.dat") -and (Test-Path $bmp) -and ((Get-Item $bmp).LastWriteTime -gt $start)) {
      Start-Sleep 10; $status = 'DONE'; break
    }
    if ($p.HasExited) { $status = "EXITED code $($p.ExitCode)"; break }
    if (((Get-Date) - $start).TotalMinutes -gt $TimeoutMin) { break }
  }
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  $min = [int]((Get-Date) - $start).TotalMinutes
  Write-Host "$title`: $status after $min min"
  if ((Test-Path $bmp) -and ((Get-Item $bmp).LastWriteTime -gt $start)) {
    $png = Join-Path $OutDir "$name.png"
    python -c "from PIL import Image; Image.MAX_IMAGE_PIXELS=None; im=Image.open(r'$bmp').convert('RGB'); print(im.size); im.resize(($Size,$Size), Image.LANCZOS).save(r'$png')"
    Write-Host "  map: $png"
  } else {
    Write-Host "  no map BMP written (export crash or gen failed); save: $save"
  }
}

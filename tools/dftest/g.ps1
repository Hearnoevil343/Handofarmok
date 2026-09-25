param([string]$Name)
& "E:\dev\hand-of-armok\tools\dftest\grab.ps1" -OutFile "$env:TEMP\hoa-westeros\sweep\$Name.png"
& "$PSScriptRoot\fg.ps1" | Out-Null

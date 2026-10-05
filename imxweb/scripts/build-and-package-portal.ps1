<#
.SYNOPSIS
  Builds the Identity Manager web portal (qer-app-portal) in production mode and
  packages every generated dist folder into a "Html_<name>.zip" archive.

.DESCRIPTION
  1. Runs `npm run build:production qer-app-portal` from the imxweb workspace root.
     Because qer-app-portal depends on qbm/qer and all the plugin libraries
     (aad, aob, apc, att, cpl, hds, iqc, olg, pol, qam, rmb, rms, rps, sac, tsb),
     Nx also (re)builds each of those, producing one folder per project under
     imxweb/dist/.
  2. Zips the CONTENTS of every folder found directly under imxweb/dist/ (not the
     folder itself), so each archive can be extracted straight into its target
     deployment location without an extra nesting level.
  3. Names each archive "Html_<folder-name>.zip" and stores it in imxweb/dist/.

.PARAMETER Project
  The Nx/Angular project to build. Defaults to "qer-app-portal".

.EXAMPLE
  .\build-and-package-portal.ps1
#>

[CmdletBinding()]
param(
    [string]$Project = "qer-app-portal"
)

$ErrorActionPreference = "Stop"

# The workspace root is the imxweb folder, i.e. the parent of this scripts/ folder.
$workspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $workspaceRoot

Write-Host "==> Building '$Project' (production) from $workspaceRoot ..." -ForegroundColor Cyan
npm run build:production $Project
if ($LASTEXITCODE -ne 0) {
    throw "Build failed with exit code $LASTEXITCODE. See the output above for details."
}

$distPath = Join-Path $workspaceRoot "dist"
if (-not (Test-Path $distPath)) {
    throw "Expected dist folder not found at $distPath"
}

$folders = Get-ChildItem -Path $distPath -Directory
if ($folders.Count -eq 0) {
    throw "No folders were found under $distPath to package. Did the build actually produce output?"
}

Write-Host ""
Write-Host "==> Packaging $($folders.Count) generated folder(s) from $distPath ..." -ForegroundColor Cyan

foreach ($folder in $folders) {
    $zipName = "Html_$($folder.Name).zip"
    $zipPath = Join-Path $distPath $zipName

    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }

    Write-Host "  - $($folder.Name) -> $zipName"
    Compress-Archive -Path (Join-Path $folder.FullName '*') -DestinationPath $zipPath -CompressionLevel Optimal
}

Write-Host ""
Write-Host "==> Done. Archives created in $distPath :" -ForegroundColor Green
Get-ChildItem -Path $distPath -Filter "Html_*.zip" |
    Select-Object Name, @{Name = "SizeMB"; Expression = { [math]::Round($_.Length / 1MB, 2) } } |
    Format-Table -AutoSize

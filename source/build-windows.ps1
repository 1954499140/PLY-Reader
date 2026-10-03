$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'Type check failed' }
$oldOS = $env:GOOS
$oldArch = $env:GOARCH
$oldCgo = $env:CGO_ENABLED
try {
  $env:GOOS = 'windows'
  $env:GOARCH = 'amd64'
  $env:CGO_ENABLED = '0'
  go build -buildvcs=false -trimpath -ldflags='-H windowsgui -s -w' -o PLY-Studio.exe .
  if ($LASTEXITCODE -ne 0) { throw 'Windows build failed' }
} finally {
  $env:GOOS = $oldOS
  $env:GOARCH = $oldArch
  $env:CGO_ENABLED = $oldCgo
}
Write-Host 'Created PLY-Studio.exe'

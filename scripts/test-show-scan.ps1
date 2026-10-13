param(
  [string]$ShowSlug = "htfjgrtkfefcrbgverdk",
  [string]$ApiKey = "sq_live_8d67cd7a9f9a33762c4fed59f528e7b8c8f1c10c5336bdf4",
  [string]$ApiUrl = "http://localhost:4000",
  [string]$GateId = "gate-main"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:TARGET_SHOW_SLUG = $ShowSlug

Write-Host "Tao QR test cho show: $ShowSlug"
$testData = node "$projectRoot\tmp\create-test-data.cjs" | ConvertFrom-Json

$payload = @{
  qr_jwt  = $testData.qrJwt
  gate_id = $GateId
} | ConvertTo-Json

try {
  $result = Invoke-RestMethod `
    -Uri "$ApiUrl/api/v1/tickets/verify" `
    -Method Post `
    -Headers @{ "x-api-key" = $ApiKey } `
    -ContentType "application/json" `
    -Body $payload

  Write-Host "POWERSHELL TEST: PASS" -ForegroundColor Green
  $result | ConvertTo-Json -Depth 10
  Write-Host "`nQR JWT test:" -ForegroundColor Cyan
  Write-Host $testData.qrJwt
}
catch {
  Write-Host "POWERSHELL TEST: FAIL" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  else { Write-Host $_.Exception.Message }
  exit 1
}

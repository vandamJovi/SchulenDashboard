$root = $PSScriptRoot
$host.UI.RawUI.WindowTitle = "Schulen-Dashboard"

Write-Host ""
Write-Host "  Schulen-Dashboard" -ForegroundColor Cyan
Write-Host "  ==================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Starte Backend..." -ForegroundColor Gray

$backend = Start-Process python -ArgumentList "app.py" `
    -WorkingDirectory "$root\backend" -PassThru -NoNewWindow

Start-Sleep -Seconds 2

Write-Host "  Starte Frontend..." -ForegroundColor Gray

$frontend = Start-Process cmd -ArgumentList "/c npm run dev" `
    -WorkingDirectory "$root\frontend" -PassThru -NoNewWindow

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "  Druecke Ctrl+C oder schliesse dieses Fenster zum Beenden." -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) { Start-Sleep 1 }
}
finally {
    Write-Host ""
    Write-Host "  Beende Server..." -ForegroundColor Yellow
    taskkill /F /T /PID $backend.Id 2>$null | Out-Null
    taskkill /F /T /PID $frontend.Id 2>$null | Out-Null
    Write-Host "  Fertig." -ForegroundColor Gray
    Start-Sleep -Seconds 1
}

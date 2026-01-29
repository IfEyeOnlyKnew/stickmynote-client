# Maintenance Server Script
# Serves a maintenance page on port 443 while the main app is being updated
# Run as Administrator

param(
    [switch]$Start,
    [switch]$Stop
)

$MaintenancePage = "C:\stick-my-note-prod\stickmynote-client\public\maintenance.html"
$CertPath = "C:\stick-my-note-prod\stickmynote-client\certs"
$Port = 443
$PidFile = "C:\stick-my-note-prod\maintenance-server.pid"

function Start-MaintenanceServer {
    Write-Host "Starting maintenance server on port $Port..." -ForegroundColor Yellow

    # Check if maintenance page exists
    if (-not (Test-Path $MaintenancePage)) {
        Write-Host "ERROR: Maintenance page not found at $MaintenancePage" -ForegroundColor Red
        exit 1
    }

    # Read the maintenance HTML
    $html = Get-Content $MaintenancePage -Raw

    # Create a simple HTTPS listener using .NET HttpListener
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("https://+:$Port/")

    try {
        $listener.Start()
        Write-Host "Maintenance server started. Press Ctrl+C to stop." -ForegroundColor Green
        Write-Host "Serving maintenance page at https://stickmynote.com/" -ForegroundColor Cyan

        # Save PID for later cleanup
        $PID | Out-File $PidFile

        while ($listener.IsListening) {
            $context = $listener.GetContext()
            $response = $context.Response

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
            $response.ContentLength64 = $buffer.Length
            $response.ContentType = "text/html; charset=utf-8"
            $response.StatusCode = 503  # Service Unavailable
            $response.Headers.Add("Retry-After", "300")  # Suggest retry in 5 minutes

            $output = $response.OutputStream
            $output.Write($buffer, 0, $buffer.Length)
            $output.Close()

            Write-Host "Served maintenance page to $($context.Request.RemoteEndPoint)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
    finally {
        $listener.Stop()
        if (Test-Path $PidFile) { Remove-Item $PidFile }
    }
}

function Stop-MaintenanceServer {
    Write-Host "Stopping maintenance server..." -ForegroundColor Yellow

    if (Test-Path $PidFile) {
        $pid = Get-Content $PidFile
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Remove-Item $PidFile
            Write-Host "Maintenance server stopped." -ForegroundColor Green
        }
        catch {
            Write-Host "Could not stop process: $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "No maintenance server PID file found." -ForegroundColor Yellow
    }
}

if ($Start) {
    Start-MaintenanceServer
}
elseif ($Stop) {
    Stop-MaintenanceServer
}
else {
    Write-Host "Usage: .\maintenance-server.ps1 -Start | -Stop" -ForegroundColor Cyan
}

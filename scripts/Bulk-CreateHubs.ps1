<#
.SYNOPSIS
    Bulk creates organization hubs from a CSV file.

.DESCRIPTION
    Reads a CSV file containing hub definitions and creates them via the Admin API.
    Useful for provisioning multiple hubs at once.

.PARAMETER CsvPath
    Path to the CSV file containing hub definitions.

.PARAMETER ServerUrl
    The base URL of the StickMyNote server. Default: http://localhost:3001

.PARAMETER ApiKey
    The admin API key. Can also be set via STICKMYNOTE_ADMIN_API_KEY environment variable.

.EXAMPLE
    .\Bulk-CreateHubs.ps1 -CsvPath ".\hubs.csv"

.NOTES
    CSV Format (required columns):
    Name,HubType,HubEmail,OwnerEmail
    
    Optional columns:
    Description,HomeCode,AccessMode,IsPublic

    Example CSV:
    Name,HubType,HubEmail,OwnerEmail,Description,AccessMode
    "Engineering Team",organization,eng@company.com,admin@company.com,"Engineering hub",individual_sticks
    "Marketing Team",organization,marketing@company.com,marketing.lead@company.com,"Marketing hub",all_sticks
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$CsvPath,

    [Parameter()]
    [string]$ServerUrl = "http://localhost:3001",

    [Parameter()]
    [string]$ApiKey = $env:STICKMYNOTE_ADMIN_API_KEY
)

# Check for API key
if (-not $ApiKey) {
    $ApiKey = Read-Host -Prompt "Enter Admin API Key"
    if (-not $ApiKey) {
        Write-Error "API key is required. Set STICKMYNOTE_ADMIN_API_KEY environment variable or use -ApiKey parameter."
        exit 1
    }
}

# Check CSV file exists
if (-not (Test-Path $CsvPath)) {
    Write-Error "CSV file not found: $CsvPath"
    exit 1
}

# Import CSV
$hubs = Import-Csv -Path $CsvPath

if ($hubs.Count -eq 0) {
    Write-Error "No hubs found in CSV file"
    exit 1
}

Write-Host "`n=== Bulk Hub Creation ===" -ForegroundColor Cyan
Write-Host "Server: $ServerUrl"
Write-Host "CSV File: $CsvPath"
Write-Host "Hubs to create: $($hubs.Count)"
Write-Host ""

$headers = @{
    "X-Admin-Api-Key" = $ApiKey
    "Content-Type"    = "application/json"
}

$uri = "$ServerUrl/api/admin/create-hub"

$successCount = 0
$failCount = 0
$results = @()

foreach ($hub in $hubs) {
    # Validate required fields
    if (-not $hub.Name -or -not $hub.HubType -or -not $hub.HubEmail -or -not $hub.OwnerEmail) {
        Write-Host "SKIPPED: Missing required fields for hub" -ForegroundColor Yellow
        $results += [PSCustomObject]@{
            Name    = $hub.Name
            Status  = "Skipped"
            Message = "Missing required fields"
        }
        $failCount++
        continue
    }

    $body = @{
        name        = $hub.Name
        hub_type    = $hub.HubType
        hub_email   = $hub.HubEmail
        owner_email = $hub.OwnerEmail
        access_mode = if ($hub.AccessMode) { $hub.AccessMode } else { "individual_sticks" }
        is_public   = if ($hub.IsPublic -eq "true") { $true } else { $false }
    }

    if ($hub.Description) {
        $body.description = $hub.Description
    }

    if ($hub.HomeCode) {
        $body.home_code = $hub.HomeCode
    }

    $jsonBody = $body | ConvertTo-Json -Depth 10

    Write-Host "Creating: $($hub.Name)..." -NoNewline

    try {
        $response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $jsonBody -ErrorAction Stop
        
        Write-Host " SUCCESS" -ForegroundColor Green
        $successCount++
        $results += [PSCustomObject]@{
            Name    = $hub.Name
            Status  = "Created"
            HubId   = $response.hub.id
            Message = $response.message
        }
    }
    catch {
        $errorMsg = "Unknown error"
        try {
            $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorMsg = $errorJson.error
        }
        catch {
            $errorMsg = $_.Exception.Message
        }
        
        Write-Host " FAILED - $errorMsg" -ForegroundColor Red
        $failCount++
        $results += [PSCustomObject]@{
            Name    = $hub.Name
            Status  = "Failed"
            Message = $errorMsg
        }
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Total: $($hubs.Count)"
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

# Output results table
$results | Format-Table -AutoSize

# Return results for pipeline use
return $results

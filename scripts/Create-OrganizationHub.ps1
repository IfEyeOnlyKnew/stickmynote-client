<#
.SYNOPSIS
    Creates organization hubs in StickMyNote via the Admin API.

.DESCRIPTION
    This script allows administrators to create individual or organization hubs
    without using the web UI. Useful for bulk provisioning or automation.

.PARAMETER ServerUrl
    The base URL of the StickMyNote server. Default: http://localhost:3001

.PARAMETER ApiKey
    The admin API key. Can also be set via STICKMYNOTE_ADMIN_API_KEY environment variable.

.PARAMETER Name
    The name of the hub (required).

.PARAMETER HubType
    The type of hub: 'individual' or 'organization' (required).

.PARAMETER HubEmail
    The contact email for the hub (required).

.PARAMETER OwnerEmail
    The email of the user who will own this hub (required).

.PARAMETER Description
    Optional description for the hub.

.PARAMETER HomeCode
    Optional unique code for the hub.

.PARAMETER AccessMode
    Access mode: 'all_sticks' or 'individual_sticks'. Default: individual_sticks

.PARAMETER IsPublic
    Whether the hub is public. Default: false

.EXAMPLE
    .\Create-OrganizationHub.ps1 -Name "Engineering Team" -HubType "organization" -HubEmail "eng@company.com" -OwnerEmail "admin@company.com"

.EXAMPLE
    .\Create-OrganizationHub.ps1 -Name "Marketing Hub" -HubType "organization" -HubEmail "marketing@company.com" -OwnerEmail "marketing.lead@company.com" -Description "Central hub for marketing team" -ApiKey "my-secret-key"

.NOTES
    Requires PowerShell 5.1 or later.
    Set the STICKMYNOTE_ADMIN_API_KEY environment variable or use -ApiKey parameter.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$ServerUrl = "http://localhost:3001",

    [Parameter()]
    [string]$ApiKey = $env:STICKMYNOTE_ADMIN_API_KEY,

    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [ValidateSet("individual", "organization")]
    [string]$HubType,

    [Parameter(Mandatory = $true)]
    [string]$HubEmail,

    [Parameter(Mandatory = $true)]
    [string]$OwnerEmail,

    [Parameter()]
    [string]$Description = "",

    [Parameter()]
    [string]$HomeCode = "",

    [Parameter()]
    [ValidateSet("all_sticks", "individual_sticks")]
    [string]$AccessMode = "individual_sticks",

    [Parameter()]
    [switch]$IsPublic
)

# Check for API key
if (-not $ApiKey) {
    $ApiKey = Read-Host -Prompt "Enter Admin API Key" -AsSecureString | ConvertFrom-SecureString -AsPlainText
    if (-not $ApiKey) {
        Write-Error "API key is required. Set STICKMYNOTE_ADMIN_API_KEY environment variable or use -ApiKey parameter."
        exit 1
    }
}

# Build the request
$headers = @{
    "X-Admin-Api-Key" = $ApiKey
    "Content-Type"    = "application/json"
}

$body = @{
    name        = $Name
    hub_type    = $HubType
    hub_email   = $HubEmail
    owner_email = $OwnerEmail
    access_mode = $AccessMode
    is_public   = $IsPublic.IsPresent
}

if ($Description) {
    $body.description = $Description
}

if ($HomeCode) {
    $body.home_code = $HomeCode
}

$jsonBody = $body | ConvertTo-Json -Depth 10

$uri = "$ServerUrl/api/admin/create-hub"

Write-Host "`n=== Creating Hub ===" -ForegroundColor Cyan
Write-Host "Server: $ServerUrl"
Write-Host "Name: $Name"
Write-Host "Type: $HubType"
Write-Host "Email: $HubEmail"
Write-Host "Owner: $OwnerEmail"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $jsonBody -ErrorAction Stop
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Hub Created:" -ForegroundColor Yellow
    Write-Host "  ID: $($response.hub.id)"
    Write-Host "  Name: $($response.hub.name)"
    Write-Host "  Type: $($response.hub.hub_type)"
    Write-Host "  Email: $($response.hub.hub_email)"
    Write-Host "  Access Mode: $($response.hub.access_mode)"
    Write-Host "  Public: $($response.hub.is_public)"
    Write-Host "  Created: $($response.hub.created_at)"
    Write-Host ""
    Write-Host $response.message -ForegroundColor Green
    
    return $response.hub
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody = $_.ErrorDetails.Message
    
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    
    if ($errorBody) {
        try {
            $errorJson = $errorBody | ConvertFrom-Json
            Write-Host "Error: $($errorJson.error)" -ForegroundColor Red
        }
        catch {
            Write-Host "Error: $errorBody" -ForegroundColor Red
        }
    }
    else {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    exit 1
}

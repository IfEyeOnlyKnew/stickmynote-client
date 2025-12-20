"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Terminal, AlertCircle, Check, CheckCircle } from "lucide-react"

interface AutomationTabProps {
  disableManualHubCreation: boolean
  setDisableManualHubCreation: (value: boolean) => void
  savingAutomationSettings: boolean
  handleSaveAutomationSettings: () => void
}

export function AutomationTab({
  disableManualHubCreation,
  setDisableManualHubCreation,
  savingAutomationSettings,
  handleSaveAutomationSettings,
}: Readonly<AutomationTabProps>) {
  return (
    <div className="space-y-6">
      <OverviewCard />
      <AutomationModeCard
        disableManualHubCreation={disableManualHubCreation}
        setDisableManualHubCreation={setDisableManualHubCreation}
        savingAutomationSettings={savingAutomationSettings}
        handleSaveAutomationSettings={handleSaveAutomationSettings}
      />
      <ApiKeySetupCard />
      <SingleHubCreationCard />
      <BulkHubCreationCard />
      <ApiReferenceCard />
    </div>
  )
}

function OverviewCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Automation &amp; Scripting
        </CardTitle>
        <CardDescription>
          Use PowerShell scripts to automate hub creation and management without the web UI.
          This is useful for IT administrators who want to provision hubs in bulk or integrate
          with existing workflows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          <AlertCircle className="h-4 w-4 inline mr-2" />
          <strong>Why use automation?</strong> Instead of users manually creating hubs via the
          &quot;Organization Hub Details&quot; form, administrators can run PowerShell scripts to
          create hubs programmatically with predefined settings.
        </div>
      </CardContent>
    </Card>
  )
}

interface AutomationModeCardProps {
  disableManualHubCreation: boolean
  setDisableManualHubCreation: (value: boolean) => void
  savingAutomationSettings: boolean
  handleSaveAutomationSettings: () => void
}

function AutomationModeCard({
  disableManualHubCreation,
  setDisableManualHubCreation,
  savingAutomationSettings,
  handleSaveAutomationSettings,
}: Readonly<AutomationModeCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Mode Settings</CardTitle>
        <CardDescription>
          Control whether users can manually create hubs through the web interface
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="disable-manual-hub-creation"
            checked={disableManualHubCreation}
            onCheckedChange={(checked) => setDisableManualHubCreation(checked === true)}
          />
          <div className="flex-1">
            <Label htmlFor="disable-manual-hub-creation" className="font-medium cursor-pointer">
              Disable manual hub creation (Automation-only mode)
            </Label>
            <p className="text-sm text-gray-500 mt-1">
              When enabled, the &quot;Create Social Pad&quot; button will be hidden from the Social page.
              Only administrators can create hubs via PowerShell scripts or the API.
            </p>
          </div>
        </div>
        {disableManualHubCreation && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 inline mr-2" />
            Users will not be able to create hubs through the web interface. Use the PowerShell
            scripts below to provision hubs for your organization.
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveAutomationSettings} disabled={savingAutomationSettings}>
          {savingAutomationSettings ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

function ApiKeySetupCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Configure API Key</CardTitle>
        <CardDescription>Set up the admin API key for authentication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Add the following to your server&apos;s <code className="bg-gray-100 px-1 rounded">.env.local</code> file
          and set the same value in PowerShell when running scripts:
        </p>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{`# Server .env.local AND PowerShell environment variable
STICKMYNOTE_ADMIN_API_KEY=your-secure-api-key-here`}
        </pre>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 inline mr-2" />
          Use a strong, unique key. This key grants full hub creation permissions.
        </div>
      </CardContent>
    </Card>
  )
}

function SingleHubCreationCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Create Single Hub</CardTitle>
        <CardDescription>PowerShell script to create one hub at a time</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Use the <code className="bg-gray-100 px-1 rounded">Create-OrganizationHub.ps1</code> script:
        </p>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{`# Set your API key
$env:STICKMYNOTE_ADMIN_API_KEY = "your-api-key-here"

# Create an organization hub
.\\scripts\\Create-OrganizationHub.ps1 \`
    -Name "Engineering Team" \`
    -HubType "organization" \`
    -HubEmail "engineering@company.com" \`
    -OwnerEmail "admin@company.com" \`
    -Description "Central hub for engineering team"`}
        </pre>
        <div className="mt-4">
          <h4 className="font-medium text-gray-900 mb-2">Available Parameters:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="bg-gray-50 p-2 rounded">
              <code className="text-purple-600">-Name</code>
              <span className="text-gray-600 ml-2">(Required) Hub name</span>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <code className="text-purple-600">-HubType</code>
              <span className="text-gray-600 ml-2">&quot;individual&quot; or &quot;organization&quot;</span>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <code className="text-purple-600">-HubEmail</code>
              <span className="text-gray-600 ml-2">(Required) Contact email</span>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <code className="text-purple-600">-OwnerEmail</code>
              <span className="text-gray-600 ml-2">(Required) Hub owner</span>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <code className="text-purple-600">-Description</code>
              <span className="text-gray-600 ml-2">(Optional) Description</span>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <code className="text-purple-600">-AccessMode</code>
              <span className="text-gray-600 ml-2">&quot;all_sticks&quot; or &quot;individual_sticks&quot;</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BulkHubCreationCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Bulk Hub Creation</CardTitle>
        <CardDescription>Create multiple hubs from a CSV file</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Use the <code className="bg-gray-100 px-1 rounded">Bulk-CreateHubs.ps1</code> script with a CSV file:
        </p>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{String.raw`.\\scripts\\Bulk-CreateHubs.ps1 -CsvPath ".\\scripts\\example-hubs.csv"`}
        </pre>
        <div className="mt-4">
          <h4 className="font-medium text-gray-900 mb-2">CSV Format:</h4>
          <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm text-gray-800">
{`Name,HubType,HubEmail,OwnerEmail,Description,AccessMode,IsPublic
"Engineering Team",organization,eng@company.com,admin@company.com,"Engineering hub",individual_sticks,false
"Marketing Team",organization,mkt@company.com,admin@company.com,"Marketing hub",all_sticks,false`}
          </pre>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 inline mr-2" />
          An example CSV file is available at <code className="bg-green-100 px-1 rounded">scripts/example-hubs.csv</code>
        </div>
      </CardContent>
    </Card>
  )
}

function ApiReferenceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Direct API Access</CardTitle>
        <CardDescription>For custom integrations or other scripting languages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Endpoint:</h4>
          <code className="block bg-gray-100 p-2 rounded text-sm">
            POST /api/admin/create-hub
          </code>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Headers:</h4>
          <pre className="bg-gray-100 p-3 rounded-lg text-sm">
{`X-Admin-Api-Key: your-api-key
Content-Type: application/json`}
          </pre>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Request Body:</h4>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "name": "Engineering Team",
  "hub_type": "organization",
  "hub_email": "eng@company.com",
  "owner_email": "admin@company.com",
  "description": "Optional description",
  "access_mode": "individual_sticks",
  "is_public": false
}`}
          </pre>
        </div>
        <p className="text-sm text-gray-500">
          Visit <code className="bg-gray-100 px-1 rounded">GET /api/admin/create-hub</code> for full API documentation.
        </p>
      </CardContent>
    </Card>
  )
}

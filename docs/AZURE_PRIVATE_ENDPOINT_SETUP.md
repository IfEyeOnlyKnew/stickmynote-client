# Azure OpenAI Private Endpoint Setup

This guide walks you through setting up Azure Private Endpoints for Azure OpenAI, ensuring all AI traffic stays on Microsoft's private network and never touches the public internet.

## Benefits of Private Endpoints

- **Maximum Privacy**: Traffic never leaves Microsoft's backbone network
- **No Public IP Exposure**: Azure OpenAI resource is not accessible from the internet
- **Compliance**: Meets strict data residency and security requirements
- **Lower Latency**: Direct private network path

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your On-Premises Network                     │
│  ┌─────────────┐                                                │
│  │ StickMyNote │                                                │
│  │   Server    │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│  ┌──────▼──────┐     VPN/ExpressRoute      ┌──────────────────┐│
│  │  Firewall   │◄──────────────────────────►│  Azure VNet     ││
│  └─────────────┘                            │                  ││
│                                             │ ┌──────────────┐ ││
│                                             │ │Private       │ ││
│                                             │ │Endpoint      │ ││
│                                             │ │10.0.1.5      │ ││
│                                             │ └──────┬───────┘ ││
│                                             │        │         ││
│                                             │ ┌──────▼───────┐ ││
│                                             │ │Azure OpenAI  │ ││
│                                             │ │Resource      │ ││
│                                             │ └──────────────┘ ││
│                                             └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Azure Subscription** with Azure OpenAI access approved
2. **Azure Virtual Network (VNet)** in your preferred region
3. **VPN Gateway or ExpressRoute** connecting your on-premises network to Azure
4. **DNS resolution** configured for private endpoints

---

## Step 1: Create Azure OpenAI Resource

### Via Azure Portal:

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **Create a resource** → Search for **Azure OpenAI**
3. Configure:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new or use existing
   - **Region**: Choose closest to your users (e.g., East US, West Europe)
   - **Name**: `stickmynote1-openai` (must be globally unique)
   - **Pricing Tier**: Standard S0
4. **IMPORTANT**: On the **Network** tab:
   - Select **Disabled** for public network access
   - This ensures the resource is only accessible via private endpoint
5. Click **Review + Create**

### Via Azure CLI:

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "Your Subscription Name"

# Create resource group (if needed)
az group create --name stickmynote-rg --location eastus

# Create Azure OpenAI resource with public access disabled
az cognitiveservices account create \
  --name stickmynote-openai \
  --resource-group stickmynote-rg \
  --kind OpenAI \
  --sku S0 \
  --location eastus \
  --custom-domain stickmynote-openai \
  --public-network-access Disabled
```

---

## Step 2: Create Virtual Network (if not exists)

### Via Azure Portal:

1. Go to **Virtual Networks** → **Create**
2. Configure:
   - **Name**: `stickmynote1-vnet`
   - **Region**: Same as your Azure OpenAI resource
   - **Address space**: `10.0.0.0/16`
   - **Subnet**: `private-endpoints` with `10.0.1.0/24`
3. Create the VNet: Move to correct resource group stickmynote-rg

### Via Azure CLI:

```bash
# Create VNet
az network vnet create \
  --name stickmynote-vnet \
  --resource-group stickmynote-rg \
  --location eastus \
  --address-prefix 10.0.0.0/16 \
  --subnet-name private-endpoints \
  --subnet-prefix 10.0.1.0/24

# Disable private endpoint network policies on subnet
az network vnet subnet update \
  --name private-endpoints \
  --vnet-name stickmynote-vnet \
  --resource-group stickmynote-rg \
  --disable-private-endpoint-network-policies true
```

---

## Step 3: Create Private Endpoint

### Via Azure Portal:

1. Go to your **Azure OpenAI resource** → **Networking** → **Private endpoint connections**
2. Click **+ Private endpoint**
3. Configure:
   - **Name**: `stickmynote1-openai-pe`
   - **Region**: Same as VNet
   - **Virtual Network**: `stickmynote-vnet`
   - **Subnet**: `private-endpoints`
   - **Target sub-resource**: `account`
- 3A. Resources:
    - 	Connection Method: Connect to an Azure resource by resource ID or alias.
      - Microsoft.CognitiveServices/accounts
1. **Private DNS Integration**:
   - Select **Yes** for "Integrate with private DNS zone"
   - This creates `privatelink.openai.azure.com` zone
2. Create the endpoint

### Via Azure CLI:

```bash
# Get the resource ID of your Azure OpenAI resource
$OPENAI_ID=$(az cognitiveservices account show \
  --name stickmynote-openai \
  --resource-group stickmynote-rg \
  --query id -o tsv)

# Create private endpoint
az network private-endpoint create \
  --name stickmynote-openai-pe \
  --resource-group stickmynote-rg \
  --vnet-name stickmynote-vnet \
  --subnet private-endpoints \
  --private-connection-resource-id $OPENAI_ID \
  --group-id account \
  --connection-name stickmynote-openai-connection

# Create private DNS zone
az network private-dns zone create \
  --name privatelink.openai.azure.com \
  --resource-group stickmynote-rg

# Link DNS zone to VNet
az network private-dns link vnet create \
  --name openai-dns-link \
  --resource-group stickmynote-rg \
  --zone-name privatelink.openai.azure.com \
  --virtual-network stickmynote-vnet \
  --registration-enabled false

# Get private endpoint IP
PE_IP=$(az network private-endpoint show \
  --name stickmynote-openai-pe \
  --resource-group stickmynote-rg \
  --query 'customDnsConfigs[0].ipAddresses[0]' -o tsv)

# Create DNS record
Az network private-dns record-set a add-record \
  --record-set-name stickmynote-openai \
  --resource-group stickmynote-rg \
  --zone-name privatelink.openai.azure.com \
  --ipv4-address $PE_IP
```

---

## Step 4: Connect On-Premises Network to Azure

### Option A: Site-to-Site VPN (Recommended for small-medium deployments)

1. **Create VPN Gateway in Azure**: Install Azure CLI to run these commands
   ```bash
   # Create gateway subnet
   az network vnet subnet create \
     --name GatewaySubnet \
     --vnet-name stickmynote-vnet \
     --resource-group stickmynote-rg \
     --address-prefix 10.0.255.0/27

   # Create public IP for VPN gateway (must be Static for VPN Gateway)
   az network public-ip create \
     --name stickmynote-vpn-ip \
     --resource-group stickmynote-rg \
     --allocation-method Static \
     --sku Standard

   # Create VPN gateway (takes 30-45 minutes)
   az network vnet-gateway create \
     --name stickmynote-vpn-gateway \
     --resource-group stickmynote-rg \
     --vnet stickmynote-vnet \
     --public-ip-addresses stickmynote-vpn-ip \
     --gateway-type Vpn \
     --vpn-type RouteBased \
     --sku VpnGw1
   ```

2. **Configure your on-premises firewall** to establish IPSec tunnel to Azure VPN Gateway

### Option B: ExpressRoute (Recommended for enterprise/high-bandwidth)

1. Work with your network provider to establish ExpressRoute circuit
2. Connect ExpressRoute circuit to your Azure VNet

---

## Step 5: Configure DNS Resolution

Your on-premises server needs to resolve `stickmynote-openai.openai.azure.com` to the private endpoint IP.

### Option A: Conditional Forwarder (Recommended)

On your on-premises DNS server (e.g., Windows DNS):

1. Create a **Conditional Forwarder** for `openai.azure.com`
2. Point it to Azure DNS: `168.63.129.16` (via VPN/ExpressRoute)

### Option B: Hosts File (Quick testing)

Add to your server's hosts file:

```
# Windows: C:\Windows\System32\drivers\etc\hosts
# Linux: /etc/hosts

10.0.1.5    stickmynote-openai.openai.azure.com
```

Replace `10.0.1.5` with your actual private endpoint IP.

---

## Step 6: Deploy a Model

1. Go to [Azure AI Studio](https://oai.azure.com/)
2. Select your Azure OpenAI resource
3. Go to **Deployments** → **Create new deployment**
4. Choose a model:
   - `gpt-4o` (recommended - best quality)
   - `gpt-4` (high quality)
   - `gpt-35-turbo` (faster, lower cost)
5. Name your deployment (e.g., `gpt-4o`)
6. Deploy

---

## Step 7: Get API Key

1. Go to your Azure OpenAI resource in Azure Portal
2. Go to **Keys and Endpoint**
3. Copy **Key 1** or **Key 2**

---

## Step 8: Configure StickMyNote

Update your `.env.local`:

```env
# Force Azure OpenAI only
AI_PROVIDER=azure

# Your Azure OpenAI configuration
AZURE_OPENAI_RESOURCE_NAME=stickmynote-openai
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Optional: Custom endpoint for private endpoints
# Only needed if using a custom domain or proxy
# AZURE_OPENAI_ENDPOINT=https://stickmynote-openai.openai.azure.com
```

---

## Firewall Rules (On-Premises)

If your on-premises network has a firewall, allow:

| Direction | Protocol | Port | Destination |
|-----------|----------|------|-------------|
| Outbound  | TCP      | 443  | Azure VPN Gateway Public IP |
| Outbound  | UDP      | 500  | Azure VPN Gateway Public IP (IKE) |
| Outbound  | UDP      | 4500 | Azure VPN Gateway Public IP (NAT-T) |
| Internal  | TCP      | 443  | Private Endpoint IP (10.0.1.5) |

---

## Verification

### Test DNS Resolution:

```bash
# Should resolve to private IP (e.g., 10.0.1.5)
nslookup stickmynote-openai.openai.azure.com
```

### Test Connectivity:

```bash
# Should connect successfully
curl -v https://stickmynote-openai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

---

## Troubleshooting

### "Connection refused" or timeout
- Verify VPN/ExpressRoute is connected
- Check DNS resolution returns private IP
- Verify NSG rules allow traffic to private endpoint

### "DNS resolution failed"
- Verify conditional forwarder is configured
- Check VPN tunnel is up
- Test with hosts file entry

### "401 Unauthorized"
- Verify API key is correct
- Check model deployment exists
- Verify deployment name matches config

---

## Cost Considerations

| Component | Approximate Cost |
|-----------|-----------------|
| Azure OpenAI (S0) | Pay per token |
| Private Endpoint | ~$7.30/month |
| VPN Gateway (VpnGw1) | ~$140/month |
| ExpressRoute | Varies by provider |

---

## Security Best Practices

1. **Rotate API keys** regularly (every 90 days)
2. **Use Azure Key Vault** to store API keys
3. **Enable diagnostic logging** on Azure OpenAI resource
4. **Set up Azure Monitor alerts** for unusual activity
5. **Restrict VNet access** with Network Security Groups
6. **Enable Microsoft Defender for Cloud** for threat detection

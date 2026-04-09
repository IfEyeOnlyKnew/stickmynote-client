# RuFlow + Claude Code Setup Guide

Setup guide for installing RuFlow (AI orchestration platform) with Claude Code on the StickyMyNote development environment.

## Overview

RuFlow transforms Claude Code into a multi-agent orchestration platform with 100+ specialized agents, automatic task routing, and vector-based memory. It integrates via MCP (Model Context Protocol) and runs through WSL2 on Windows Server 2022.

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Claude Code | Installed via VS Code extension |
| VS Code | With Claude Code extension active |
| Windows Server 2022 | HOL-DC2-IIS (192.168.50.20) or dev machine |
| Node.js 20+ | Required by RuFlow |
| Nested Virtualization | Required for WSL2 on Hyper-V VMs |

---

## Step 1: Enable Nested Virtualization (Hyper-V VMs Only)

If the target machine is a Hyper-V VM, nested virtualization must be enabled **from the Hyper-V host**.

On the **host machine**, open PowerShell as Administrator:

```powershell
# Shut down the VM first
Stop-VM -Name "YourVMName"

# Enable nested virtualization
Set-VMProcessor -VMName "YourVMName" -ExposeVirtualizationExtensions $true

# Start the VM
Start-VM -Name "YourVMName"
```

To find VM names on the host:

```powershell
Get-VM
```

---

## Step 2: Enable Windows Features (Inside the VM)

On the target machine, open PowerShell as Administrator:

```powershell
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart
```

If `Microsoft-Hyper-V-All` is not found (Windows Server):

```powershell
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

**Restart the machine** after enabling features.

---

## Step 3: Install WSL2 with Ubuntu 24.04

After reboot, open PowerShell as Administrator:

```powershell
wsl --install -d Ubuntu-24.04
```

This downloads and installs Ubuntu 24.04 LTS. You will be prompted to create a default Unix user account.

### WSL User Account

| Field | Value |
|-------|-------|
| Username | `chrisdoran` |
| Password | `sameaslogin` |

> **Security Note:** Change this password after initial setup if this machine is network-accessible. Run `passwd` inside the WSL terminal to update it.

---

## Step 4: Install RuFlow

Open the VS Code terminal (`` Ctrl+` ``) and switch to the WSL/bash shell, then run the full install:

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/ruflo@main/scripts/install.sh | bash -s -- --full
```

The `--full` flag includes:
- RuFlow core installation
- MCP integration (connects RuFlow to Claude Code)
- Diagnostic tools
- Interactive configuration wizard

If Node.js is not found, install it first:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
```

Then retry the RuFlow install command.

### Alternative Install Methods

**Quick install (no MCP/diagnostics):**
```bash
curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/ruflo@main/scripts/install.sh | bash
```

**Via npx with interactive wizard:**
```bash
npx ruflo@latest init --wizard
```

---

## Step 5: Initialize RuFlow

> **Important:** Run `init` from your WSL home directory, not from a `/mnt/c/` path. Writing into the Windows filesystem from WSL causes permission errors (`EPERM: operation not permitted`).

```bash
cd ~
npx ruflo init --wizard
```

Successful initialization output:

```
Initializing RuFlo V3

RuFlo V3 initialized successfully!

+-------- Summary --------+
| Directories: 11 created |
| Files: 116 created      |
+-------------------------+

+---------- Claude Code Integration -----------+
| CLAUDE.md:   Swarm guidance & configuration  |
| Settings:    .claude/settings.json           |
| Skills:      .claude/skills/ (30 skills)     |
| Commands:    .claude/commands/ (10 commands) |
| Agents:      .claude/agents/ (98 agents)     |
| Helpers:     .claude/helpers/                |
| MCP:         .mcp.json                       |
+----------------------------------------------+

+------------- V3 Runtime --------------+
| Config:      .claude-flow/config.yaml |
| Data:        .claude-flow/data/       |
| Logs:        .claude-flow/logs/       |
| Sessions:    .claude-flow/sessions/   |
+---------------------------------------+

[INFO] Hooks: 7 hook types enabled in settings.json
```

---

## Step 6: Post-Init Setup

After initialization, start the background services:

```bash
# Start background workers
claude-flow daemon start

# Initialize memory database
claude-flow memory init

# Initialize a swarm
claude-flow swarm init

# Or do all of the above at once
claude-flow init --start-all
```

### Provider Configuration

Configure the Anthropic (Claude) provider at minimum. Ollama can also be connected since we have a local Ollama server at `192.168.50.70`.

Review hook configurations in `.claude/settings.json`.

---

## Usage

After initialization, use Claude Code normally in VS Code. RuFlow operates in the background:

- **Hooks** (7 types) automatically route tasks to specialized agents
- **Skills** (30) available as slash commands in Claude Code
- **Agents** (98) specialized agents for different task types
- **Commands** (10) available via `.claude/commands/`
- **MCP integration** exposes RuFlow tools within Claude Code sessions
- **Memory system** maintains context across sessions using vector search

No additional commands are required for basic operation. The orchestration layer is transparent.

### Useful Commands

```bash
# Check RuFlow status
npx ruflo status

# List available agents
npx ruflo agents list

# Run diagnostics
npx ruflo diagnose
```

---

## Troubleshooting

### WSL Install Fails: HCS_E_HYPERV_NOT_INSTALLED

Nested virtualization is not enabled. Follow Step 1 on the Hyper-V host.

### WSL Install Fails: Virtual Machine Platform Not Enabled

Run the `dism.exe` commands from Step 2 and restart.

### curl Not Found in WSL

```bash
sudo apt update && sudo apt install -y curl
```

### Node.js Version Too Old

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## Architecture Reference

| Server | IP | Role |
|--------|----|------|
| HOL-DC2-IIS | 192.168.50.20 | App Server (StickyMyNote + RuFlow) |
| HOL-OLLAMA | 192.168.50.70 | Ollama AI Server (optional RuFlow provider) |

## References

- RuFlow GitHub: https://github.com/ruvnet/ruflo
- Claude Code docs: https://docs.anthropic.com/en/docs/claude-code

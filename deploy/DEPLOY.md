# KVM Deployment Guide

Deploy SpriteMancer + Gemini Proxy to your Ubuntu 24.04 KVM server.

## Prerequisites

- Ubuntu 24.04 VPS with root access
- Domain: `zerograft.online` with DNS configured
- SSH key access

## Step 1: Initial Server Setup

```bash
# SSH into your server
ssh root@your-kvm-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

## Step 2: Configure DNS

Add these A records pointing to your KVM IP:

| Subdomain | Type | Value |
|-----------|------|-------|
| `spritemancer` | A | `YOUR_KVM_IP` |
| `api` | A | `YOUR_KVM_IP` |
| `gemini` | A | `YOUR_KVM_IP` |

## Step 3: Upload Files

From your Mac:

```bash
# Create deployment folder on server
ssh root@your-kvm-ip "mkdir -p /opt/spritemancer"

# Upload docker-compose and configs
scp -r deploy/* root@your-kvm-ip:/opt/spritemancer/

# Upload SpriteMancer backend code
scp -r Spritemancerai/backend/* root@your-kvm-ip:/opt/spritemancer/backend/

# Upload SpriteMancer frontend code
scp -r Spritemancerai/frontend/* root@your-kvm-ip:/opt/spritemancer/frontend/

# Upload Gemini proxy code
scp deploy/gemini-proxy/* root@your-kvm-ip:/opt/spritemancer/gemini-proxy/
```

## Step 4: Configure Environment

```bash
ssh root@your-kvm-ip
cd /opt/spritemancer

# Create .env from template
cp .env.example .env

# Edit with your real values
nano .env
```

## Step 5: Deploy

```bash
cd /opt/spritemancer

# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## Step 6: Verify

Test each endpoint:

```bash
# Backend health
curl https://api.zerograft.online/health

# Frontend
curl https://spritemancer.zerograft.online

# Gemini proxy health
curl https://gemini.zerograft.online/health
```

## Troubleshooting

### View logs
```bash
docker compose logs backend
docker compose logs frontend
docker compose logs gemini-proxy
docker compose logs caddy
```

### Restart a service
```bash
docker compose restart backend
```

### Rebuild after code changes
```bash
docker compose up -d --build
```

### Check SSL certificates
```bash
docker compose exec caddy caddy list-certificates
```

## Firewall

Ensure these ports are open:

```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP (redirects to HTTPS)
ufw allow 443   # HTTPS
ufw enable
```

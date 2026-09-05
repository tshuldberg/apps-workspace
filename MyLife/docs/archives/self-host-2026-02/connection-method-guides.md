# Self-Host Internet Reachability Guides

Date: 2026-02-25
Audience: MyLife self-host operators who want cross-home messaging without MyLife relay servers.

## Goal
Make your home MyLife node reachable over the internet so federation can deliver messages between independent homes.

## Shared Prerequisites (all methods)
1. MyLife self-host stack running and healthy:
- `docker compose --env-file .env up -d --build`
- `curl -sS http://localhost:8787/health`

2. Federation env configured in `deploy/self-host/.env`:
- `MYLIFE_FEDERATION_SERVER=<public-hostname>`
- `MYLIFE_FEDERATION_SHARED_KEY=<shared-hmac-secret>` or per-peer map in `MYLIFE_FEDERATION_SHARED_KEYS`
- optional: `MYLIFE_FEDERATION_DISPATCH_KEY=<secret>`

3. Dispatch worker running on schedule:
- `POST /api/federation/dispatch` every 10-30s (cron/systemd/timer/worker loop)

4. Firewall allows HTTPS ingress to the endpoint that fronts your node.

## Method 1: Port Forwarding + Domain + TLS
Best for: full control, minimal provider dependency.

### Pros
- Direct internet-to-home delivery path.
- No tunnel service dependency in traffic path.
- Predictable architecture for long-term operation.

### Cons
- Requires router + firewall + reverse proxy setup.
- May fail if ISP uses CGNAT or blocks inbound ports.
- Public exposure increases security maintenance responsibility.

### Step-by-step
1. Reserve static LAN IP on your router for MyLife host.
2. Run reverse proxy on home server (Caddy/NGINX) listening on `443`.
3. Create DNS record `home.example.com -> <public-ip>`.
4. Add router forwarding rule: WAN `443` -> LAN `<proxy-host>:443`.
5. Proxy requests to local API `http://127.0.0.1:8787`.
6. Enable automatic cert issuance (Let’s Encrypt via Caddy/NGINX tooling).
7. Validate from external network:
- `curl -i https://home.example.com/health`
- expect `200` and `status: ok`.
8. In app wizard, select this method, set URL, save, and run connection test.

### Caddy example
```caddy
home.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

### NGINX example
```nginx
server {
  listen 443 ssl http2;
  server_name home.example.com;

  ssl_certificate /etc/letsencrypt/live/home.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/home.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

## Method 2: Dynamic DNS + Port Forwarding
Best for: residential internet with changing IP.

### Pros
- Handles changing public IP automatically.
- Keeps direct architecture and local control.
- Inexpensive and stable after setup.

### Cons
- Still requires forwarding + reverse proxy + TLS.
- Reachability depends on DDNS updater health.
- DNS propagation/update lag can cause short outages.

### Step-by-step
1. Create DDNS hostname (example `mylife-home.duckdns.org`).
2. Install DDNS updater on router/server to keep record current.
3. Configure reverse proxy + TLS for DDNS hostname.
4. Configure WAN `443` forwarding to proxy host.
5. Test from mobile data:
- `curl -i https://mylife-home.duckdns.org/health`
6. Simulate IP change (router reconnect) and verify DNS re-updates.
7. Save DDNS URL in app wizard and run connection test.

### Operational note
Set DDNS updater as a system service and alert if update fails for more than one interval.

## Method 3: Outbound Tunnel (No Inbound Port Open)
Best for: CGNAT, blocked inbound ports, or fastest setup.

### Pros
- No router port-forwarding required.
- Works on restrictive home ISP setups.
- Fastest onboarding for most users.

### Cons
- Depends on tunnel provider availability.
- Additional network hop and possible latency.
- Must keep tunnel client continuously running.

### Step-by-step
1. Install tunnel client (Cloudflare Tunnel, Tailscale Funnel, ngrok reserved domain).
2. Map public hostname to local service `http://localhost:8787`.
3. Confirm provider issues HTTPS endpoint.
4. Verify external health:
- `curl -i https://<public-tunnel-host>/health`
5. Configure tunnel service auto-start and restart-on-failure.
6. Save tunnel URL in app wizard and run connection test.

### Cloudflare tunnel quick example
```bash
cloudflared tunnel login
cloudflared tunnel create mylife-home
cloudflared tunnel route dns mylife-home mylife-home.example.com
cloudflared tunnel run --url http://localhost:8787 mylife-home
```

## Post-Setup Validation (all methods)
1. App self-host wizard connection test returns all PASS checks.
2. Federation dispatch returns successful processing:
- `POST /api/federation/dispatch`
3. Cross-home message exchange succeeds with accepted friend pair.
4. Outbox has no growing retry backlog:
- inspect `federation_message_outbox` for repeated failures.

## Security Baseline
1. Use HTTPS for all internet-facing endpoints.
2. Keep `MYLIFE_FEDERATION_SHARED_KEY` secret and rotate when compromised.
3. Restrict dispatch endpoint with `MYLIFE_FEDERATION_DISPATCH_KEY`.
4. Keep host patched; monitor proxy, tunnel, and DB logs.

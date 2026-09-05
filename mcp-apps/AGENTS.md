# MCP apps

- No analytics or tracking. Operational metering may record tool name, wallet, price, duration, and cache status, never request/response bodies.
- Disclose third-party calls and the data sent in each app's README privacy section and /privacy endpoint.
- Every deployed app needs a /privacy endpoint, included in FREE_PATHS in mcp_shared/free_trial.py so it remains accessible without payment or a wallet.
- No cookies, session storage, or browser fingerprinting. Do not track client identity beyond the payment wallet. Disclosures identify the provider, when a call happens, the data sent, and the provider privacy-policy link.
- IP addresses are for ephemeral rate limiting only; never persist them in metering, correlate beyond the rate window, or share them with third parties.
- Preserve deletion/retention promises in the app's privacy contract.

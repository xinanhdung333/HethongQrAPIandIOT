# API key pepper rotation runbook

1. Set `API_KEY_PEPPER_ROLLOVER_UNTIL` to a specific absolute date, then set `API_KEY_PEPPER_PREVIOUS` to the currently deployed `API_KEY_PEPPER`.
2. Generate a new random value with `openssl rand -hex 32`, set it as `API_KEY_PEPPER`, and deploy the API.
3. Monitor the admin summary counters `legacy_api_key_hashes.previous_hits_today` and `sha256_hits_today`.
4. Remove `API_KEY_PEPPER_PREVIOUS` only after the absolute rollover date has elapsed and the `previous` counter remains at `0`.
5. Treat the pre-pepper SHA-256 format as an independent migration. Set `API_KEY_LEGACY_SHA256_UNTIL` only after its `sha256` counter has stayed at `0` for at least 14 days.

`*_DAYS` remains a compatibility fallback based on the build timestamp, but new rotations must use absolute `*_UNTIL` dates.

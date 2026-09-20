# SmartQR secrets

Generate random values with:

```bash
openssl rand -hex 32
```

| Variable | Used in | If lost | Rotation |
| --- | --- | --- | --- |
| `DATABASE_URL` | Prisma database connection | API cannot read or write data | Yes, update the database credentials and deployment secret |
| `REDIS_URL` | Sessions, rate limits, QR replay protection | Sessions and replay/rate-limit state become unavailable | Yes |
| `JWT_SECRET` | Web login JWTs and legacy QR fallback | Existing login tokens and legacy QR tokens stop verifying | Yes, with a planned token/QR rollover |
| `QR_JWT_SECRET` | Online ticket QR JWT signing | Existing online ticket QR tokens stop verifying | Yes, using the legacy fallback window |
| `API_KEY_PEPPER` | HMAC hashing API keys | API keys cannot be looked up unless the previous pepper is retained | Yes, with `API_KEY_PEPPER_PREVIOUS` during the migration window |
| `API_SECRET_ENCRYPTION_KEY` | Encrypting stored API signing/webhook secrets | Stored encrypted secrets cannot be decrypted | Only with an explicit decrypt/re-encrypt migration |
| `PAYMENT_LINK_SECRET` | Demo payment link signing | Existing payment links fail verification | Yes, after expiring old links |
| `PAYMENT_DEMO_MODE` | Enables insecure demo payment-link callbacks | Demo callbacks are rejected | Never enable in production |
| `PAYOS_WEBHOOK_SECRET` | PayOS webhook verification | Payment callbacks cannot be trusted | Yes, coordinate with PayOS |
| `WEB_ORIGIN` | CORS and generated public URLs | Browser requests and generated links use the wrong origin | Yes |

Production must define every variable above. Development may use the documented local fallbacks, but they must never be reused in production.

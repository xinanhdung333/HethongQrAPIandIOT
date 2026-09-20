# ADR: CSRF token strategy

## Decision

Keep the CSRF cookie/header check for browser mutations outside the public API
prefixes. The browser caches one token and refreshes it only after a token mismatch.

## Rationale

This protects routes that authenticate through cookies from cross-site form or fetch
requests. The token endpoint reuses a valid cookie, so concurrent mutations do not
invalidate one another.

The protection does not cover `/api/v1/*`, webhooks, or payment callbacks. Those
interfaces authenticate with explicit bearer/API-key or signed headers; browsers do
not attach those headers cross-site automatically. Applying cookie CSRF checks to
the public API would break SDKs, scanners, and integrations without adding useful
protection.

## Revisit

If browser sessions move to an HttpOnly cookie, expand CSRF protection to every
cookie-authenticated mutation, including API routes. If authentication remains in
an explicit `Authorization` header and cookies are not used for authorization,
this lightweight layer can eventually be removed.

import hashlib
import hmac
import json
import time
from urllib import request, parse


class SmartQrClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:4000", signing_secret: str | None = None):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.signing_secret = signing_secret

    def create_qr_code(self, payload: dict, idempotency_key: str | None = None) -> dict:
        return self._request("POST", "/api/v1/qr-codes", payload, idempotency_key)

    def create_qr_codes(self, resources: list[dict], idempotency_key: str | None = None) -> dict:
        return self._request("POST", "/api/v1/qr-codes/bulk", {"resources": resources}, idempotency_key)

    def get_qr_svg_url(self, qr_id: str) -> str:
        return f"{self.base_url}/api/v1/qr-codes/{parse.quote(qr_id)}/svg?api_key={parse.quote(self.api_key)}"

    def verify_ticket(self, payload: dict, idempotency_key: str | None = None) -> dict:
        return self._request("POST", "/api/v1/tickets/verify", payload, idempotency_key)

    def sign_request(self, timestamp: int, method: str, path: str, body: str) -> str:
        if not self.signing_secret:
            raise ValueError("signing_secret is required")
        digest = hmac.new(self.signing_secret.encode(), f"{timestamp}{method.upper()}{path}{body}".encode(), hashlib.sha256).hexdigest()
        return f"sha256={digest}"

    def _request(self, method: str, path: str, payload: dict, idempotency_key: str | None = None) -> dict:
        body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
        headers = {"Content-Type": "application/json", "X-API-KEY": self.api_key}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        if self.signing_secret:
            ts = int(time.time())
            body_text = body.decode()
            headers["X-Timestamp"] = str(ts)
            headers["X-Signature"] = self.sign_request(ts, method, path, body_text)
        req = request.Request(self.base_url + path, data=body, headers=headers, method=method)
        with request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode())

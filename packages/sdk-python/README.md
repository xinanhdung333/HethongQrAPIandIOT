# SmartQR Python SDK

SDK mong cho Python backend hoac IoT gateway goi SmartQR API.

```python
from smartqr_client import SmartQrClient

client = SmartQrClient("sk_test_xxx", "http://localhost:4000")
qr = client.create_qr_code({
    "resource_type": "iot_session",
    "resource_id": "session-001",
    "metadata": {"gate": "A1"},
})

result = client.verify_ticket({
    "ticket_code": qr["ticket_code"],
    "gate_id": "A1",
})
```

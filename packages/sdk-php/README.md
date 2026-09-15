# SmartQR PHP SDK

SDK mong cho backend PHP/IoT server goi SmartQR API.

```php
require './SmartQrClient.php';

$client = new SmartQrClient(getenv('SMARTQR_API_KEY'), 'http://localhost:4000');
$qr = $client->createQrCode([
  'resource_type' => 'iot_device',
  'resource_id' => 'gate-01-session-001',
  'metadata' => ['gate' => 'A1']
]);

$result = $client->verifyTicket([
  'ticket_code' => $qr['ticket_code'],
  'gate_id' => 'A1'
]);
```

<?php

class SmartQrClient
{
    private string $baseUrl;
    private string $apiKey;
    private ?string $signingSecret;

    public function __construct(string $apiKey, string $baseUrl = 'http://localhost:4000', ?string $signingSecret = null)
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->signingSecret = $signingSecret;
    }

    public function createQrCode(array $payload, ?string $idempotencyKey = null): array
    {
        return $this->request('POST', '/api/v1/qr-codes', $payload, $idempotencyKey);
    }

    public function createQrCodes(array $resources, ?string $idempotencyKey = null): array
    {
        return $this->request('POST', '/api/v1/qr-codes/bulk', ['resources' => $resources], $idempotencyKey);
    }

    public function getQrSvgUrl(string $id): string
    {
        return $this->baseUrl . '/api/v1/qr-codes/' . rawurlencode($id) . '/svg?api_key=' . rawurlencode($this->apiKey);
    }

    public function verifyTicket(array $payload, ?string $idempotencyKey = null): array
    {
        return $this->request('POST', '/api/v1/tickets/verify', $payload, $idempotencyKey);
    }

    public function signRequest(int $timestamp, string $method, string $path, string $body): string
    {
        if (!$this->signingSecret) {
            throw new RuntimeException('signingSecret is required');
        }
        return 'sha256=' . hash_hmac('sha256', $timestamp . strtoupper($method) . $path . $body, $this->signingSecret);
    }

    private function request(string $method, string $path, array $payload, ?string $idempotencyKey): array
    {
        $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $headers = [
            'Content-Type: application/json',
            'X-API-KEY: ' . $this->apiKey,
        ];
        if ($idempotencyKey) $headers[] = 'Idempotency-Key: ' . $idempotencyKey;
        if ($this->signingSecret) {
            $timestamp = time();
            $headers[] = 'X-Timestamp: ' . $timestamp;
            $headers[] = 'X-Signature: ' . $this->signRequest($timestamp, $method, $path, $body);
        }
        $ch = curl_init($this->baseUrl . $path);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_POSTFIELDS => $body]);
        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($response === false) throw new RuntimeException(curl_error($ch));
        $decoded = json_decode($response, true);
        if ($status < 200 || $status >= 300) throw new RuntimeException($response);
        return $decoded;
    }
}

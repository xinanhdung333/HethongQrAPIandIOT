
# SPEC FINAL V3 - P3: IoT + BÃI XE - AI READY

## Mục tiêu
Phần cứng cắm thêm vào P1+P2 đã chạy. Web không cần sửa. IoT là client gọi API verify đã có. Bãi xe là Phase 2.1

## Tech Stack
SP-01 Mini: ESP32 DevKit V1 + GM65 UART 9600 + OLED SSD1306 I2C + Buzzer + Servo SG90 + Pin 18650 TP4056. Firmware Arduino C++ lib WiFiManager, HTTPClient, ArduinoJson, U8g2, ESP32Servo
SP-02 Pro: Raspberry Pi 4 2GB + Honeywell 1470g + Màn 5 inch HDMI + Relay + ESP32-CAM. Python requests opencv paho-mqtt

## Rules cho AI
Bảo mật: API Key lưu EEPROM không hardcode, HTTPS header X-API-KEY X-GATE-ID, không log JWT Serial
Cache Offline Performance: Offline lưu SPIFFS LittleFS offline.json 100 vé, khi có mạng gửi batch POST /api/v1/tickets/verify/batch, Quét <1s UART interrupt, OLED Online/Offline số vé hôm nay, tự reconnect WiFi, LED xanh OK đỏ Fail vàng Offline
Quality: Tách file wifi_manager.h qr_scanner.h api_client.h display.h, endpoint local 192.168.4.1 config WiFi API Key

## Firmware Flow SP-01
Setup: WiFiManager autoConnect -> đọc API_KEY GATE_ID EEPROM -> OLED "Online - Gate: xxx"
Loop: Đợi QR GM65 Serial2 -> qr_jwt -> OLED "Đang kiểm tra..." -> POST https://api.smartpass.com/api/v1/tickets/verify Header X-API-KEY body {qr_jwt, gate_id} -> 200 {valid:true, userName} -> OLED "Welcome {userName}" + Buzzer + Servo 90 độ 3s. Fail -> "Vé không hợp lệ" + Buzzer dài
Offline: Lưu {qr_jwt, timestamp} offline.json -> OLED "Offline - Đã lưu"

## API P1 dùng lại
POST /api/v1/tickets/verify đã có
Thêm mới: POST /api/v1/tickets/verify/batch {tickets: [{qr_jwt, timestamp, gate_id}]}

## Bãi xe Phase 2.1
Bảng: parking_tickets id customer_id license_plate nullable checkin_at checkout_at fee status in/out/paid gate_in_id gate_out_id image_in_url
pricing_rules id customer_id free_minutes default 15 price_per_hour price_per_day
API: POST /parking/checkin {license_plate?, gate_id, image_base64?} -> ticket_jwt checkin_at
POST /parking/checkout {ticket_jwt hoặc license_plate, gate_id} -> tính fee = max(0, (now - checkin - free)/60*price)
GET /parking/status?customer_id -> total_slots occupied available
AI biển số optional Pi YOLOv8 license-plate-vn + PaddleOCR -> đọc biển -> gọi checkin. Nếu AI fail cho phép tạo vé QR thủ công

## Phí thiệt hại
rental_orders.gate_ids điền khi ship. damage_reports id rental_order_id gate_id type lost/broken/scratch fee status

## Acceptance
1. SP-01 bật, WiFi portal, nhập API Key
2. Tạo QR dashboard P1, quét GM65 -> mở servo <1s, OLED tên, dashboard nhảy số realtime
3. Tắt WiFi quét 2 vé -> OLED Offline đã lưu 2, bật WiFi -> sync batch
4. /parking/checkin 1h sau checkout tính đúng phí
5. (Optional) Camera Pi đọc biển 80%

## Prompt AI Coder
Build firmware ESP32 GM65 OLED Servo WiFiManager offline batch + 2 API parking checkin checkout tính phí + damage_reports. Dùng lại API verify P1.

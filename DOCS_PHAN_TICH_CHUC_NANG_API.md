
## 1.1 Danh sach API endpoint (chi liet ke cac diem thay doi so voi ban truoc)

### POST /admin/api-keys — CHUA VA, VAN LA LO HONG THAT (xac nhan lai 2026-09-12)
- Scope/permission can co: admin JWT.
- Request body / query param chinh: `user_id`, `quota?`.
- Response format chinh: API key moi, `api_key_once`.
- **Van de xac nhan qua code:** endpoint nay tao key voi `scopes: FULL_API_KEY_SCOPES` (full quyen mac dinh), **khong yeu cau/khong gan `rental_id`**, **khong kiem tra plan key limit** truoc khi tao. Day la duong vong thuc su qua toan bo he thong scope/quota/rental limit da xay o cac phase truoc.
- Trang thai: **chua sua**. Day la viec uu tien cao nhat con lai, tuong ung Phase F.1 da de xuat truoc do nhung chua duoc thuc thi.

### POST /api/v1/developer/keys/:id/rotate — (dinh chinh 2026-09-12)
- Scope/permission can co: user JWT, owner API key.
- Request body / query param chinh: `id`, **`password` (bat buoc, da xac nhan qua code `DeveloperRotateKeyDto`)**.
- Response format chinh: `api_key_once`, `key`.
- Trang thai: da lam. (Ban truoc ghi "chua co xac thuc lai password khi rotate" — sai, da co tu truoc, chi la chua cap nhat lai muc 1.6.)

### POST /api/v1/qr-codes/bulk — (dinh chinh 2026-09-12)
- Trang thai: da lam, **va co check feature flag runtime**: neu `feature_flags.bulk_create = false` trong system settings, endpoint tra loi `403 feature_disabled` ngay, da xac nhan qua `qr-platform.service.ts` (`assertFeature("bulk_create", ...)`).

### POST /api/v1/payments — (dinh chinh 2026-09-12)
- Scope/permission can co: API key scope `ticket:verify` (xac nhan dung nhu tai lieu bao cao, chua doi sang scope rieng `payment:create`).
- Trang thai: da lam, **va co check feature flag `pay_as_you_go`**: neu tat trong system settings, tra loi `403 feature_disabled`, xac nhan qua `payment-transactions.service.ts`.
- Luu y con lai: ten scope `ticket:verify` cho hanh dong "tao giao dich thanh toan" van con gay kho hieu ve ngu nghia — chua doi, van la diem nen cai thien.

## 1.2 Danh sach trang UI (chi liet ke cac diem thay doi so voi ban truoc)

### /dashboard/api-keys — (dinh chinh 2026-09-12)
- Trang thai: da lam. **IP whitelist dang dung component `IpWhitelistEditor` dang tag input that** (xac nhan qua code `app/dashboard/api-keys/page.tsx`), khong con la input dang comma-separated nhu ghi truoc do. Ho tro nhap exact IP / CIDR / IPv4 range dung nhu backend xu ly.

### /admin/api-platform — (dinh chinh 2026-09-12)
- Trang thai: da lam day du hon ghi truoc do.
- **Da co nut "Reveal" cho payout account cua user**, goi `POST /api/v1/admin/payout-accounts/:id/reveal` (xac nhan qua `admin-console`/`page.tsx`, khong con la "backend co nhung UI chua co nut" nhu ghi truoc).
- **Da co form tao incident** (nhap tieu de + trang thai) va **nut Resolve** cho incident dang mo, goi dung `/api/v1/admin/incidents` (khong con la "chua co UI tao/sua incident" nhu ghi truoc).

## 1.5 Danh sach cau hinh he thong (chi liet ke cac diem thay doi so voi ban truoc)

### system_settings.api_platform — (dinh chinh 2026-09-12)
- Trang thai: **da ap dung runtime that**, khong con la "luu duoc nhung chua dung" nhu ghi truoc.
- `feature_flags.api_explorer` — check trong `api-key.guard.ts`, tra `403 feature_disabled` khi tat.
- `feature_flags.bulk_create` — check trong `qr-platform.service.ts`.
- `feature_flags.pay_as_you_go` — check trong `qr-platform.service.ts` va `payment-transactions.service.ts`.
- `quota_warning_thresholds` — job `api-maintenance.service.ts` doc truc tiep tu setting nay (co fallback ve `[80, 95]` neu setting rong/loi), khong con hardcode cung trong code.
- `plan_limits.<plan>.max_keys` — da ap dung khi tao test key/rotate key qua `developer.service.ts` (tra loi `403 api_key_limit_exceeded` khi vuot han); **nhung khong ap dung cho `POST /admin/api-keys`** (xem lai muc F.1 o tren — day chinh la ly do route do la lo hong).

### Email provider — (dinh chinh 2026-09-12)
- Trang thai: **da tich hop that**, khong con la "chua co provider that" nhu ghi truoc.
- Dung SMTP that qua `nodemailer` (khong phai Resend nhu de xuat truoc do — team da chon huong SMTP truc tiep), doc qua env `SMARTQR_SMTP_HOST`/`SMTP_HOST`, `SMARTQR_SMTP_PORT`/`SMTP_PORT`, `SMARTQR_SMTP_USER`/`SMTP_USER`, `SMARTQR_SMTP_PASS`/`SMTP_PASS`, `SMARTQR_SMTP_SECURE`/`SMTP_SECURE`.
- Co them kenh phu: `API_NOTIFICATION_WEBHOOK_URL` — gui thong bao qua webhook ngoai email neu can.
- Neu khong set bien nao ca, notification van ghi DB nhung throw loi `notification_provider_not_configured` khi worker co gang gui — can kiem tra lai xem loi nay co lam retry lien tuc khong thanh cong mai khong (dedupe/attempts co giu dung khong), nen xac minh them.
- Worker gui notification (`notification-delivery.service.ts`) co lease/lock chong xu ly trung, retry theo lich `1p/5p/30p/60p` (4 muc, nhieu hon 3 lan da ghi truoc — xac nhan lai bang `RETRY_MS` co 4 gia tri).

## 1.6 Danh sach viec CHUA lam / con thieu (da doi chieu lai 2026-09-12)

**Con that, uu tien cao:**
- [ ] `POST /admin/api-keys` van tao key khong gan `rental_id`, khong ap dung plan key limit, mac dinh full scope — van la duong vong that qua toan bo he thong scope/quota/rental limit. **Day la viec uu tien so 1 con lai.**

**Con that, nhung khong con la loi bao mat/logic — chi la cai thien nho:**
- [ ] Scope `ticket:verify` dung chung cho ca "verify ve" lan "tao giao dich thanh toan" — nen tach scope rieng `payment:create` de ro ngu nghia hon, khong bat buoc gap.
- [ ] IP whitelist chua ho tro nhap dang mask kieu khac ngoai CIDR chuan (da co CIDR/IPv4 range, du dung cho da so nhu cau).
- [ ] Avatar upload chua resize/optimize that bang image processor (van giu nguyen tu ban truoc, chua doi chieu lai code phan nay ky).
- [ ] `payout_note` van dung luu metadata dang JSON string thay vi cot JSON rieng (chua doi chieu lai code phan nay ky, gan dung nguyen tu ban truoc).

**Da xac nhan SAI trong ban truoc, XOA khoi danh sach chua lam vi thuc te DA LAM:**
- ~~UI edit IP whitelist dang comma-separated~~ → da la tag input that.
- ~~Admin reveal payout account chua co nut UI~~ → da co nut Reveal trong `/admin/api-platform`.
- ~~Chua co UI tao/sua incident~~ → da co form tao + nut Resolve trong `/admin/api-platform`.
- ~~Feature flags luu duoc nhung chua ap dung runtime~~ → da ap dung that cho ca 3 flag.
- ~~Quota warning thresholds luu duoc nhung job van dung nguong cung~~ → job da doc tu setting that.
- ~~Chua co email provider that~~ → da co qua SMTP/nodemailer.
- ~~Chua co xac thuc lai password khi rotate API key~~ → da co, endpoint bat buoc `password`.

**Chua doi chieu duoc trong lan nay (thieu du lieu, can kiem tra rieng khi co day du repo):**
- [ ] PHP SDK va Python SDK — file zip doi chieu khong co thu muc `packages/`, chua xac nhan lai duoc trang thai that.
- [ ] Invoice/payment provider that cho pay-as-you-go — chua doi chieu code phan nay trong lan nay.
- [ ] Payout provider that (thay the mark payout completed thu cong) — chua doi chieu code phan nay.
- [ ] CIDR support — **da xac nhan CO THAT** qua `security/api-security.ts` (`matchesCidr`, `matchesIpv4Range`), khac voi ghi chu sai trong ban truoc.
- [ ] `system_settings.quota_warning_thresholds` UI chinh sua — chua kiem tra ky UI, chi xac nhan backend da doc dung.
- [ ] Chua co E2E browser test cho cac UI moi — chua doi chieu lai trong lan nay.
- [ ] Migration/rollback SQL, schema Prisma chi tiet — khong co trong pham vi file doi chieu lan nay (khong co `packages/database`).

## Quy uoc duy tri tai lieu tu 2026-09-09

- Moi task code xong phai cap nhat file nay truoc khi tra loi final.
- Moi endpoint moi hoac doi hanh vi endpoint cu phai sua block endpoint tuong ung trong muc 1.1.
- Moi route UI moi hoac doi hanh vi route cu phai sua muc 1.2.
- Moi bang/cot/migration moi phai sua muc 1.3.
- Moi job/env/system setting moi phai sua muc 1.4 hoac 1.5.
- Changelog append-only ghi vao `DOCS_CHUC_NANG_TELEX.md`, them muc moi o cuoi file, khong sua/xoa muc cu tru khi can danh dau viec nen lam tiep da hoan thanh theo quy tac moi.
- **Bai hoc tu lan sai lech nay:** khi Codex bao "da lam" mot muc, nen kem theo duong dan file/dong code cu the de lan sau (hoac nguoi khac) doi chieu nhanh, thay vi chi ghi mo ta chung chung — giup tranh tinh trang tai lieu bi lech khoi code that nhu lan nay.
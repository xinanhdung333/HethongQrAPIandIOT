"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUpdateStaticPageDto = exports.AdminCreateApiKeyDto = exports.AdminUpdateShowDto = exports.AdminUpdateProductDto = exports.BuyProductDto = exports.CreateExternalQrDto = exports.VerifyTicketDto = exports.PayosWebhookDto = exports.BuyTicketDto = exports.ShowDto = exports.UpdateApiKeyScopesDto = exports.ApiRentalDto = exports.RentalDto = exports.UpdateProfileDto = exports.LoginDto = exports.RegisterDto = void 0;
const class_validator_1 = require("class-validator");
class RegisterDto {
    email;
    password;
}
exports.RegisterDto = RegisterDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
class LoginDto {
    email;
    password;
}
exports.LoginDto = LoginDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
class UpdateProfileDto {
    email;
    password;
}
exports.UpdateProfileDto = UpdateProfileDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "password", void 0);
class RentalDto {
    product_id;
    type;
    duration;
    quantity;
    shipping_address;
    agree_damage_terms;
}
exports.RentalDto = RentalDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RentalDto.prototype, "product_id", void 0);
__decorate([
    (0, class_validator_1.IsIn)(["rent", "buy"]),
    __metadata("design:type", String)
], RentalDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RentalDto.prototype, "duration", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RentalDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RentalDto.prototype, "shipping_address", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RentalDto.prototype, "agree_damage_terms", void 0);
class ApiRentalDto {
    app_name;
    website;
    callback_url;
    plan;
    duration;
    scopes;
}
exports.ApiRentalDto = ApiRentalDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ApiRentalDto.prototype, "app_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApiRentalDto.prototype, "website", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApiRentalDto.prototype, "callback_url", void 0);
__decorate([
    (0, class_validator_1.IsIn)(["starter", "business"]),
    __metadata("design:type", String)
], ApiRentalDto.prototype, "plan", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ApiRentalDto.prototype, "duration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(["qr:create", "qr:read", "ticket:verify"], { each: true }),
    __metadata("design:type", Array)
], ApiRentalDto.prototype, "scopes", void 0);
class UpdateApiKeyScopesDto {
    scopes;
}
exports.UpdateApiKeyScopesDto = UpdateApiKeyScopesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(["qr:create", "qr:read", "ticket:verify"], { each: true }),
    __metadata("design:type", Array)
], UpdateApiKeyScopesDto.prototype, "scopes", void 0);
class ShowDto {
    name;
    banner;
    theme_color;
    location;
    start_at;
    end_at;
    ticket_price;
    total_tickets;
    description;
    payout_account;
}
exports.ShowDto = ShowDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ShowDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ShowDto.prototype, "banner", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ShowDto.prototype, "theme_color", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ShowDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ShowDto.prototype, "start_at", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ShowDto.prototype, "end_at", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1000),
    __metadata("design:type", Number)
], ShowDto.prototype, "ticket_price", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ShowDto.prototype, "total_tickets", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ShowDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ShowDto.prototype, "payout_account", void 0);
class BuyTicketDto {
    buyer_name;
    buyer_email;
    buyer_phone;
    buyer_note;
    quantity;
}
exports.BuyTicketDto = BuyTicketDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuyTicketDto.prototype, "buyer_name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], BuyTicketDto.prototype, "buyer_email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BuyTicketDto.prototype, "buyer_phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuyTicketDto.prototype, "buyer_note", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], BuyTicketDto.prototype, "quantity", void 0);
class PayosWebhookDto {
    order_id;
    kind;
}
exports.PayosWebhookDto = PayosWebhookDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayosWebhookDto.prototype, "order_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayosWebhookDto.prototype, "kind", void 0);
class VerifyTicketDto {
    qr_jwt;
    ticket_code;
    gate_id;
}
exports.VerifyTicketDto = VerifyTicketDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], VerifyTicketDto.prototype, "qr_jwt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], VerifyTicketDto.prototype, "ticket_code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], VerifyTicketDto.prototype, "gate_id", void 0);
class CreateExternalQrDto {
    resource_type;
    resource_id;
    customer_ref;
    payload;
    ttl_seconds;
}
exports.CreateExternalQrDto = CreateExternalQrDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateExternalQrDto.prototype, "resource_type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateExternalQrDto.prototype, "resource_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExternalQrDto.prototype, "customer_ref", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateExternalQrDto.prototype, "payload", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(60),
    __metadata("design:type", Number)
], CreateExternalQrDto.prototype, "ttl_seconds", void 0);
class BuyProductDto {
    quantity;
    shipping_address;
}
exports.BuyProductDto = BuyProductDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], BuyProductDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], BuyProductDto.prototype, "shipping_address", void 0);
class AdminUpdateProductDto {
    name;
    price_sell;
    price_rent_month;
    deposit_fee;
    stock;
    images;
}
exports.AdminUpdateProductDto = AdminUpdateProductDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminUpdateProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminUpdateProductDto.prototype, "price_sell", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminUpdateProductDto.prototype, "price_rent_month", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminUpdateProductDto.prototype, "deposit_fee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminUpdateProductDto.prototype, "stock", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], AdminUpdateProductDto.prototype, "images", void 0);
class AdminUpdateShowDto {
    status;
}
exports.AdminUpdateShowDto = AdminUpdateShowDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminUpdateShowDto.prototype, "status", void 0);
class AdminCreateApiKeyDto {
    user_id;
    rental_id;
}
exports.AdminCreateApiKeyDto = AdminCreateApiKeyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminCreateApiKeyDto.prototype, "user_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminCreateApiKeyDto.prototype, "rental_id", void 0);
class AdminUpdateStaticPageDto {
    nav_label;
    title;
    description;
    hero_image;
    cta_primary;
    cta_secondary;
    sections;
    sort_order;
    published;
}
exports.AdminUpdateStaticPageDto = AdminUpdateStaticPageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminUpdateStaticPageDto.prototype, "nav_label", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminUpdateStaticPageDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminUpdateStaticPageDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminUpdateStaticPageDto.prototype, "hero_image", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], AdminUpdateStaticPageDto.prototype, "cta_primary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], AdminUpdateStaticPageDto.prototype, "cta_secondary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], AdminUpdateStaticPageDto.prototype, "sections", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AdminUpdateStaticPageDto.prototype, "sort_order", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminUpdateStaticPageDto.prototype, "published", void 0);

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
exports.ApiVerifyQrDto = exports.ApiBulkCreateQrDto = exports.ApiCreateQrDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
/** v1 accepts arbitrary resource types: integrations do not need server plugins. */
class ApiCreateQrDto {
    resource_type;
    resource_id;
    customer_ref;
    payload;
    metadata;
    ttl_seconds;
    max_uses;
    allowed_gate_ids;
    not_before;
}
exports.ApiCreateQrDto = ApiCreateQrDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ApiCreateQrDto.prototype, "resource_type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], ApiCreateQrDto.prototype, "resource_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], ApiCreateQrDto.prototype, "customer_ref", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ApiCreateQrDto.prototype, "payload", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ApiCreateQrDto.prototype, "metadata", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(60),
    __metadata("design:type", Number)
], ApiCreateQrDto.prototype, "ttl_seconds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1000000),
    __metadata("design:type", Number)
], ApiCreateQrDto.prototype, "max_uses", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(128, { each: true }),
    __metadata("design:type", Array)
], ApiCreateQrDto.prototype, "allowed_gate_ids", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ApiCreateQrDto.prototype, "not_before", void 0);
class ApiBulkCreateQrDto {
    resources;
}
exports.ApiBulkCreateQrDto = ApiBulkCreateQrDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ApiCreateQrDto),
    __metadata("design:type", Array)
], ApiBulkCreateQrDto.prototype, "resources", void 0);
class ApiVerifyQrDto {
    qr_jwt;
    ticket_code;
    gate_id;
}
exports.ApiVerifyQrDto = ApiVerifyQrDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8192),
    __metadata("design:type", String)
], ApiVerifyQrDto.prototype, "qr_jwt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8192),
    __metadata("design:type", String)
], ApiVerifyQrDto.prototype, "ticket_code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], ApiVerifyQrDto.prototype, "gate_id", void 0);

import { applyDecorators, SetMetadata } from "@nestjs/common";

export const REQUIRE_API_KEY = "require_api_key";
export const API_KEY_SCOPE = "api_key_scope";
export type ApiKeyScope = "qr:create" | "qr:read" | "ticket:verify";

export const RequireApiKey = (scope?: ApiKeyScope) => applyDecorators(
  SetMetadata(REQUIRE_API_KEY, true),
  SetMetadata(API_KEY_SCOPE, scope)
);

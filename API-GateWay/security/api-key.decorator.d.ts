export declare const REQUIRE_API_KEY = "require_api_key";
export declare const API_KEY_SCOPE = "api_key_scope";
export type ApiKeyScope = "qr:create" | "qr:read" | "ticket:verify";
export declare const RequireApiKey: (scope?: ApiKeyScope) => <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;

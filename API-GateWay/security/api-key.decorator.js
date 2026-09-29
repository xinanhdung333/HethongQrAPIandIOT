"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireApiKey = exports.API_KEY_SCOPE = exports.REQUIRE_API_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRE_API_KEY = "require_api_key";
exports.API_KEY_SCOPE = "api_key_scope";
const RequireApiKey = (scope) => (0, common_1.applyDecorators)((0, common_1.SetMetadata)(exports.REQUIRE_API_KEY, true), (0, common_1.SetMetadata)(exports.API_KEY_SCOPE, scope));
exports.RequireApiKey = RequireApiKey;

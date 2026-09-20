UPDATE "revoked_resources" AS revoked
SET "show_id" = ticket."show_id"
FROM "tickets" AS ticket
WHERE revoked."resource_type" = 'ticket'
  AND revoked."jti" = ticket."jti"
  AND revoked."show_id" IS NULL;

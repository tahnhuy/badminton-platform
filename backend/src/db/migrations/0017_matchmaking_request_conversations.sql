CREATE TABLE "matchmaking_request_conversations" (
  "request_id" bigint PRIMARY KEY REFERENCES "matchmaking_requests"("id"),
  "conversation_id" bigint NOT NULL UNIQUE REFERENCES "conversations"("id")
);

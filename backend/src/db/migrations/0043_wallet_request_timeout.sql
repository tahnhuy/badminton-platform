ALTER TABLE "wallet_payout_requests" ADD COLUMN "expires_at" timestamp DEFAULT now() + interval '15 minutes' NOT NULL;
-- Existing requests retain the previous 15-minute policy, measured from creation.
UPDATE wallet_payout_requests SET expires_at = created_at + interval '15 minutes';
INSERT INTO system_configs (config_key, config_value, description)
VALUES ('WALLET_REQUEST_TIMEOUT_MINUTES', '15', 'Validity of wallet top-up and payout requests from creation, in minutes')
ON CONFLICT (config_key) DO NOTHING;

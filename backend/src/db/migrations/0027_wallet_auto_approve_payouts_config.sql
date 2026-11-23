INSERT INTO "system_configs" ("config_key", "config_value", "description")
VALUES ('WALLET_AUTO_APPROVE_PAYOUTS', 'true', 'Automatically approve wallet payout requests (sandbox/demo); Admin still marks paid')
ON CONFLICT ("config_key") DO NOTHING;

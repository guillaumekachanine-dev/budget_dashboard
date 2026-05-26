
-- Migration 4b: Hide the Bitcoin savings-account-side transactions to prevent
-- double-counting in v_savings_transfers_enriched.
-- The checking-account-side transactions (transfer_out) are the canonical source.
-- Hiding these credit-side entries removes them from all views that filter is_hidden=false
-- while the checking account debits still drive the funding summary correctly.
UPDATE budget_dashboard.transactions
SET is_hidden = true, updated_at = now()
WHERE id IN (
  '50a1e8f8-bb0c-4280-b717-02743cef3d6d',  -- Bitcoin acct side: Achat Bitcoin BTC-1
  '6a05d97d-2c4b-4304-8153-da5311a7b5dd'   -- Bitcoin acct side: Achat Bitcoin (ex BTC-2)
);
;

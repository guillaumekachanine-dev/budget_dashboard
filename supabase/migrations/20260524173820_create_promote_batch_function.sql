
-- Fonction de promotion : staging (approved) → transactions (production)
-- Appelée depuis le front via supabase.rpc('promote_batch', { p_batch_id: '...' })
-- SECURITY INVOKER : s'exécute dans le contexte de l'utilisateur authentifié, RLS s'applique normalement
CREATE OR REPLACE FUNCTION budget_dashboard.promote_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = budget_dashboard, public
AS $$
DECLARE
  v_batch          record;
  v_promoted_count integer := 0;
  v_skipped_count  integer := 0;
  v_duplicate_count integer := 0;
BEGIN
  -- 1. Vérifier que le batch existe, appartient à l'utilisateur et est prêt
  SELECT * INTO v_batch
  FROM budget_dashboard.import_batches
  WHERE id = p_batch_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch introuvable ou accès refusé (id: %)', p_batch_id;
  END IF;

  IF v_batch.status != 'pending_review' THEN
    RAISE EXCEPTION 'Ce batch ne peut pas être promu — statut actuel: %', v_batch.status;
  END IF;

  -- 2. Compter les lignes non éligibles à la promotion (pour le rapport final)
  SELECT count(*) INTO v_skipped_count
  FROM budget_dashboard.transactions_staging
  WHERE import_batch_id = p_batch_id
    AND user_id = auth.uid()
    AND (
      review_status  != 'approved'
      OR parsed_ok   = false
      OR target_account_id IS NULL
      OR parsed_transaction_date IS NULL
      OR parsed_amount IS NULL
    );

  -- 3. Compter les doublons potentiels (external_id déjà présent en production)
  SELECT count(*) INTO v_duplicate_count
  FROM budget_dashboard.transactions_staging s
  INNER JOIN budget_dashboard.transactions t ON t.external_id = s.external_id
  WHERE s.import_batch_id = p_batch_id
    AND s.user_id = auth.uid()
    AND s.review_status = 'approved'
    AND s.external_id IS NOT NULL;

  -- 4. Insérer les lignes approuvées dans transactions (ON CONFLICT = silencieux pour les doublons)
  WITH ins AS (
    INSERT INTO budget_dashboard.transactions (
      user_id,
      account_id,
      category_id,
      import_batch_id,
      staging_row_id,
      transaction_date,
      amount,
      currency,
      direction,
      flow_type,
      budget_behavior,
      raw_label,
      normalized_label,
      merchant_name,
      external_id,
      is_recurring,
      is_verified,
      is_hidden,
      notes
    )
    SELECT
      s.user_id,
      s.target_account_id,
      s.target_category_id,
      s.import_batch_id,
      s.id,
      s.parsed_transaction_date,
      s.parsed_amount,
      'EUR',
      COALESCE(s.direction, 'expense'),
      COALESCE(s.target_flow_type, 'expense'),
      COALESCE(s.budget_behavior, c.budget_behavior, 'variable'),
      s.raw_label,
      s.normalized_label,
      s.merchant_name,
      s.external_id,
      false,
      true,   -- is_verified = true : validé manuellement par l'utilisateur
      false,
      s.validation_notes
    FROM budget_dashboard.transactions_staging s
    LEFT JOIN budget_dashboard.categories c ON c.id = s.target_category_id
    WHERE s.import_batch_id = p_batch_id
      AND s.user_id = auth.uid()
      AND s.review_status = 'approved'
      AND s.parsed_ok = true
      AND s.target_account_id IS NOT NULL
      AND s.parsed_transaction_date IS NOT NULL
      AND s.parsed_amount IS NOT NULL
    ON CONFLICT (external_id) WHERE external_id IS NOT NULL
    DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_promoted_count FROM ins;

  -- 5. Mettre à jour le statut du batch
  UPDATE budget_dashboard.import_batches
  SET
    status     = 'completed',
    row_count  = v_promoted_count,
    updated_at = timezone('utc', now())
  WHERE id = p_batch_id;

  -- 6. Retourner un rapport de la promotion
  RETURN jsonb_build_object(
    'batch_id',        p_batch_id,
    'promoted',        v_promoted_count,
    'skipped',         v_skipped_count,
    'duplicates',      v_duplicate_count,
    'promoted_at',     timezone('utc', now())
  );
END;
$$;

-- Grant d'exécution pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION budget_dashboard.promote_batch(uuid) TO authenticated;
;

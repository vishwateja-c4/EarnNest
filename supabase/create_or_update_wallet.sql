-- create_or_update_wallet.sql
-- Secure RPC to insert or update a wallet row for a given user_id
-- Run this file in the Supabase SQL editor (Query Editor) as an authenticated project admin

CREATE OR REPLACE FUNCTION public.create_or_update_wallet(
  p_user_id UUID,
  p_available_balance DECIMAL(10,2),
  p_locked_balance DECIMAL(10,2)
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  INSERT INTO public.wallets (user_id, available_balance, locked_balance, updated_at)
  VALUES (p_user_id, p_available_balance, p_locked_balance, now())
  ON CONFLICT (user_id) DO UPDATE
  SET available_balance = public.wallets.available_balance + (p_available_balance - public.wallets.available_balance),
      locked_balance = EXCLUDED.locked_balance,
      updated_at = now();

  -- Return helpful info
  SELECT json_build_object(
    'success', true,
    'user_id', p_user_id,
    'available_balance', (SELECT available_balance FROM public.wallets WHERE user_id = p_user_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated role so client-side RPC calls can use it
GRANT EXECUTE ON FUNCTION public.create_or_update_wallet(UUID, DECIMAL, DECIMAL) TO authenticated;

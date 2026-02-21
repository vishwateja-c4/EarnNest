CREATE OR REPLACE FUNCTION update_freelancer_score(
  p_freelancer_id UUID,
  p_rating NUMERIC
) RETURNS void AS $$
DECLARE
  v_current_score NUMERIC;
  v_current_count INTEGER;
  v_new_score NUMERIC;
BEGIN
  -- 1. Get current stats
  SELECT reliability_score, completed_tasks_count 
  INTO v_current_score, v_current_count
  FROM profiles 
  WHERE id = p_freelancer_id;

  -- 2. Calculate new score (moving average out of 5, rounded to 1 decimal)
  -- ((current * count) + rating) / (count + 1)
  v_new_score := ROUND((((COALESCE(v_current_score, 0) * COALESCE(v_current_count, 0)) + p_rating) / (COALESCE(v_current_count, 0) + 1)), 1);

  -- 3. Update the profile
  UPDATE profiles 
  SET 
    reliability_score = v_new_score,
    completed_tasks_count = COALESCE(v_current_count, 0) + 1
  WHERE id = p_freelancer_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

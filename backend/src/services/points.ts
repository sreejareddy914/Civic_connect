import { SupabaseClient } from '@supabase/supabase-js';

export const POINT_VALUES = {
  VALID_ISSUE_REPORT: 10,
  VALID_VERIFICATION: 15,
  UPVOTE: 2,
  USEFUL_COMMENT: 3,
  VERIFICATION_BONUS: 10
};

export const CIVIC_LEVELS = [
  { name: 'New Citizen', min: 0, max: 49 },
  { name: 'Active Citizen', min: 50, max: 149 },
  { name: 'Community Helper', min: 150, max: 299 },
  { name: 'Civic Champion', min: 300, max: Infinity }
];

export function getCivicLevel(points: number) {
  const level = CIVIC_LEVELS.find(l => points >= l.min && points <= l.max);
  return level ? level.name : 'New Citizen';
}

export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  actionType: keyof typeof POINT_VALUES,
  referenceId: string,
  description: string
) {
  const points = POINT_VALUES[actionType];
  
  // 1. Try to insert the transaction
  // The UNIQUE constraint (user_id, action_type, reference_id) will prevent duplicate rewards
  const { error: insertError } = await supabase
    .from('civic_point_transactions')
    .insert({
      user_id: userId,
      points,
      action_type: actionType,
      reference_id: referenceId,
      description
    });

  if (insertError) {
    if (insertError.code === '23505') {
      // Unique violation - already rewarded for this action
      return { success: false, reason: 'Already rewarded' };
    }
    console.error('Error inserting point transaction:', insertError);
    return { success: false, error: insertError };
  }

  // 2. Recalculate total points from history to maintain consistency
  const { data: transactions, error: fetchError } = await supabase
    .from('civic_point_transactions')
    .select('points')
    .eq('user_id', userId);

  if (fetchError) {
    console.error('Error fetching transactions:', fetchError);
    return { success: true, warning: 'Points awarded but balance sync failed' };
  }

  const totalPoints = transactions.reduce((sum, t) => sum + t.points, 0);

  // 3. Update the profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ civic_points: totalPoints })
    .eq('id', userId);

  if (updateError) {
    console.error('Error updating profile points:', updateError);
  }

  return { success: true, pointsAwarded: points, newTotal: totalPoints };
}

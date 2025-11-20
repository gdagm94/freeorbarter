import { supabase } from './supabase';
import { unfriend } from './friends';

interface BlockOptions {
  blockerId: string;
  blockedId: string;
}

const orPairQuery = (a: string, b: string) =>
  `and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`;

export async function blockUserWithCleanup({ blockerId, blockedId }: BlockOptions) {
  if (!blockerId || !blockedId || blockerId === blockedId) {
    throw new Error('Invalid block parameters');
  }

  await unfriend(blockerId, blockedId);

  await Promise.all([
    supabase
      .from('friend_requests')
      .delete()
      .or(
        `and(sender_id.eq.${blockerId},receiver_id.eq.${blockedId}),and(sender_id.eq.${blockedId},receiver_id.eq.${blockerId})`,
      ),
    supabase
      .from('barter_offers')
      .delete()
      .or(orPairQuery(blockerId, blockedId)),
  ]);

  const { error } = await supabase
    .from('blocked_users')
    .insert([{ blocker_id: blockerId, blocked_id: blockedId }]);

  if (error && error.code !== '23505') {
    throw error;
  }
}

export async function unblockUserPair({ blockerId, blockedId }: BlockOptions) {
  if (!blockerId || !blockedId) {
    throw new Error('Invalid unblock parameters');
  }

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) {
    throw error;
  }
}



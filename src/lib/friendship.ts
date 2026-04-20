import type { SupabaseClient } from '@supabase/supabase-js';

export type FriendshipStatus = 'self' | 'friends' | 'request_sent' | 'request_received' | 'none';

export async function getFriendshipStatus(
  supabase: SupabaseClient,
  myId: string,
  theirId: string
): Promise<FriendshipStatus> {
  if (myId === theirId) return 'self';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('follows')
    .select('follower_id, following_id, status')
    .eq('type', 'user')
    .or(`and(follower_id.eq.${myId},following_id.eq.${theirId}),and(follower_id.eq.${theirId},following_id.eq.${myId})`);

  const rows = (data ?? []) as { follower_id: string; following_id: string; status: string }[];
  const meToThem = rows.find(r => r.follower_id === myId && r.following_id === theirId);
  const themToMe = rows.find(r => r.follower_id === theirId && r.following_id === myId);

  if (meToThem?.status === 'accepted' && themToMe?.status === 'accepted') return 'friends';
  if (meToThem?.status === 'pending') return 'request_sent';
  if (themToMe?.status === 'pending') return 'request_received';
  return 'none';
}

export async function getFriends(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; username: string; display_name: string; avatar_url: string | null }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: iFollow } = await (supabase as any)
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('type', 'user')
    .eq('status', 'accepted');

  const followingIds = ((iFollow ?? []) as { following_id: string }[]).map(r => r.following_id);
  if (followingIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mutual } = await (supabase as any)
    .from('follows')
    .select(`
      follower_id,
      profile:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('following_id', userId)
    .eq('type', 'user')
    .eq('status', 'accepted')
    .in('follower_id', followingIds);

  return ((mutual ?? []) as any[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.profile)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => r.profile as { id: string; username: string; display_name: string; avatar_url: string | null });
}

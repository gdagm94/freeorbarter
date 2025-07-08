import { supabase } from './supabase';
import { FriendRequest, Friendship, FriendRequestWithUser, FriendshipWithUser, FriendshipStatus } from '../types';

/**
 * Send a friend request to another user
 */
export async function sendFriendRequest(senderId: string, receiverId: string): Promise<{ data: null; error: Error | null }> {
  try {
    // Check if users are already friends or have pending request
    const existingStatus = await getFriendshipStatus(senderId, receiverId);
    
    if (existingStatus !== 'none') {
      return { data: null, error: new Error('Friend request already exists or users are already friends') };
    }

    const { error } = await supabase
      .from('friend_requests')
      .insert([{
        sender_id: senderId,
        receiver_id: receiverId,
        status: 'pending'
      }]);

    if (error) throw error;

    // Trigger real-time notification
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: `private-user-${receiverId}`,
          event: 'new-notification',
          data: {
            type: 'friend_request',
            senderId: senderId
          }
        })
      });
    } catch (pusherError) {
      console.error('Error triggering real-time notification:', pusherError);
      // Don't fail the friend request if Pusher fails
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to send friend request') };
  }
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(requestId: string): Promise<{ error: Error | null }> {
  try {
    // First get the friend request details for notification
    const { data: requestData, error: fetchError } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) throw error;

    // Trigger real-time notification to the original sender
    if (requestData) {
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: `private-user-${requestData.sender_id}`,
            event: 'new-notification',
            data: {
              type: 'friend_request_approved',
              senderId: requestData.receiver_id
            }
          })
        });
      } catch (pusherError) {
        console.error('Error triggering real-time notification:', pusherError);
        // Don't fail the acceptance if Pusher fails
      }
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Failed to accept friend request') };
  }
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(requestId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined' })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) throw error;

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Failed to decline friend request') };
  }
}

/**
 * Cancel a pending friend request (sender can cancel their own request)
 */
export async function cancelFriendRequest(requestId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) throw error;

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Failed to cancel friend request') };
  }
}

/**
 * Unfriend a user (delete friendship)
 */
export async function unfriend(currentUserId: string, friendUserId: string): Promise<{ error: Error | null }> {
  try {
    // Ensure consistent ordering for the query
    const user1Id = currentUserId < friendUserId ? currentUserId : friendUserId;
    const user2Id = currentUserId < friendUserId ? friendUserId : currentUserId;

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id);

    if (error) throw error;

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Failed to unfriend user') };
  }
}

/**
 * Get friendship status between two users
 */
export async function getFriendshipStatus(currentUserId: string, otherUserId: string): Promise<FriendshipStatus> {
  try {
    // Check if they are friends
    const user1Id = currentUserId < otherUserId ? currentUserId : otherUserId;
    const user2Id = currentUserId < otherUserId ? otherUserId : currentUserId;

    const { data: friendshipData } = await supabase
      .from('friendships')
      .select('id')
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .limit(1);

    const friendship = friendshipData && friendshipData.length > 0 ? friendshipData[0] : null;

    if (friendship) {
      return 'friends';
    }

    // Check for pending friend requests
    const { data: sentRequestData } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('sender_id', currentUserId)
      .eq('receiver_id', otherUserId)
      .eq('status', 'pending')
      .limit(1);

    const sentRequest = sentRequestData && sentRequestData.length > 0 ? sentRequestData[0] : null;

    if (sentRequest) {
      return 'pending_sent';
    }

    const { data: receivedRequestData } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('sender_id', otherUserId)
      .eq('receiver_id', currentUserId)
      .eq('status', 'pending')
      .limit(1);

    const receivedRequest = receivedRequestData && receivedRequestData.length > 0 ? receivedRequestData[0] : null;

    if (receivedRequest) {
      return 'pending_received';
    }

    return 'none';
  } catch (err) {
    console.error('Error getting friendship status:', err);
    return 'none';
  }
}

/**
 * Get a user's friends list
 */
export async function getFriendsList(userId: string): Promise<{ data: FriendshipWithUser[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        user1:user1_id (
          id,
          username,
          avatar_url,
          rating
        ),
        user2:user2_id (
          id,
          username,
          avatar_url,
          rating
        )
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform the data to include the friend's info
    const friendships: FriendshipWithUser[] = (data || []).map(friendship => ({
      ...friendship,
      friend: friendship.user1_id === userId ? friendship.user2 : friendship.user1
    }));

    return { data: friendships, error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error('Failed to fetch friends list') };
  }
}

/**
 * Get pending friend requests received by a user
 */
export async function getPendingRequests(userId: string): Promise<{ data: FriendRequestWithUser[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        *,
        sender:sender_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error('Failed to fetch pending requests') };
  }
}

/**
 * Get sent friend requests by a user
 */
export async function getSentRequests(userId: string): Promise<{ data: FriendRequestWithUser[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        *,
        receiver:receiver_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('sender_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error('Failed to fetch sent requests') };
  }
}

/**
 * Get mutual friends between two users
 */
export async function getMutualFriends(currentUserId: string, otherUserId: string): Promise<{ data: FriendshipWithUser[]; error: Error | null }> {
  try {
    // Get current user's friends
    const { data: currentUserFriends, error: currentError } = await getFriendsList(currentUserId);
    if (currentError) throw currentError;

    // Get other user's friends
    const { data: otherUserFriends, error: otherError } = await getFriendsList(otherUserId);
    if (otherError) throw otherError;

    // Find mutual friends
    const currentFriendIds = new Set(currentUserFriends.map(f => f.friend?.id).filter(Boolean));
    const mutualFriends = otherUserFriends.filter(f => f.friend?.id && currentFriendIds.has(f.friend.id));

    return { data: mutualFriends, error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error('Failed to fetch mutual friends') };
  }
}

/**
 * Get friend request by ID (for accepting/declining)
 */
export async function getFriendRequest(requestId: string): Promise<{ data: FriendRequestWithUser | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        *,
        sender:sender_id (
          id,
          username,
          avatar_url
        ),
        receiver:receiver_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('id', requestId)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to fetch friend request') };
  }
}
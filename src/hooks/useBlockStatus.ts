import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface BlockStatusState {
  blockedByMe: boolean;
  blockedByOther: boolean;
  myBlockId: string | null;
  otherBlockId: string | null;
  loading: boolean;
}

export function useBlockStatus(currentUserId?: string, otherUserId?: string) {
  const [state, setState] = useState<BlockStatusState>({
    blockedByMe: false,
    blockedByOther: false,
    myBlockId: null,
    otherBlockId: null,
    loading: !!(currentUserId && otherUserId),
  });

  const refresh = useCallback(async () => {
    if (!currentUserId || !otherUserId) {
      setState({
        blockedByMe: false,
        blockedByOther: false,
        myBlockId: null,
        otherBlockId: null,
        loading: false,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    const { data, error } = await supabase
      .from('blocked_users')
      .select('id, blocker_id, blocked_id')
      .or(
        `and(blocker_id.eq.${currentUserId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${currentUserId})`,
      );

    if (error) {
      console.error('Failed to load block status', error);
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    const blockedByMeRow = data?.find((row) => row.blocker_id === currentUserId);
    const blockedByOtherRow = data?.find((row) => row.blocker_id === otherUserId);

    setState({
      blockedByMe: Boolean(blockedByMeRow),
      blockedByOther: Boolean(blockedByOtherRow),
      myBlockId: blockedByMeRow?.id ?? null,
      otherBlockId: blockedByOtherRow?.id ?? null,
      loading: false,
    });
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    const channel = supabase
      .channel(`block-status-${currentUserId}-${otherUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${currentUserId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${otherUserId}` },
        () => refresh(),
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, otherUserId, refresh]);

  return {
    blockedByMe: state.blockedByMe,
    blockedByOther: state.blockedByOther,
    isEitherBlocked: state.blockedByMe || state.blockedByOther,
    myBlockId: state.myBlockId,
    otherBlockId: state.otherBlockId,
    loading: state.loading,
    refresh,
  };
}



import { supabase } from './supabase';

export interface Policy {
  id: string;
  version: number;
  title: string;
  content: string;
  publishedAt: string;
}

export interface PolicyStatus {
  policy: Policy;
  accepted: boolean;
  acceptedAt?: string | null;
}

export async function fetchLatestPolicy(): Promise<PolicyStatus | null> {
  const { data, error } = await supabase.functions.invoke<{
    policy?: Policy;
    accepted: boolean;
    acceptance?: { accepted_at: string | null };
  }>('policy-latest', {
    method: 'GET',
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to load policy.');
  }

  if (!data?.policy) {
    return null;
  }

  return {
    policy: data.policy,
    accepted: data.accepted,
    acceptedAt: data.acceptance?.accepted_at ?? null,
  };
}

export async function acceptPolicy(policyId: string, platform: 'ios' | 'android') {
  const { data, error } = await supabase.functions.invoke<{ success: boolean }>('policy-accept', {
    body: {
      policyId,
      platform,
    },
  });

  if (error || !data?.success) {
    throw new Error(error?.message ?? 'Failed to accept policy.');
  }
}


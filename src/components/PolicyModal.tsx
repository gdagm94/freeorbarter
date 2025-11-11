import React, { useEffect, useState } from 'react';
import { Policy, acceptPolicy } from '../lib/policy';

interface PolicyModalProps {
  policy: Policy;
  open: boolean;
  onAccepted: () => void;
  onLogoutRequested?: () => void;
}

export function PolicyModal({ policy, open, onAccepted, onLogoutRequested }: PolicyModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAcknowledged(false);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await acceptPolicy(policy.id, 'web');
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record acceptance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">{policy.title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Effective {new Date(policy.publishedAt).toLocaleDateString()} • Version {policy.version}
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4 text-sm leading-relaxed text-gray-700 prose prose-sm">
          {policy.content.split('\n').map((line, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>

        <div className="space-y-4 border-t border-gray-200 px-6 py-4">
          <label className="flex items-start space-x-3 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 cursor-pointer text-indigo-600 focus:ring-indigo-500"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              disabled={submitting}
            />
            <span>
              I have read and agree to the FreeorBarter community guidelines and zero tolerance policy. I understand that violating
              these rules may result in immediate removal of my content or account.
            </span>
          </label>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={onLogoutRequested}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
              type="button"
            >
              Sign out instead
            </button>
            <button
              onClick={handleAccept}
              disabled={!acknowledged || submitting}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'I Agree'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


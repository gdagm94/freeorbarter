import { useEffect, useState } from 'react';
import { fetchLatestPolicy, PolicyStatus } from '../lib/policy';

function Terms() {
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPolicy = async () => {
      try {
        setLoading(true);
        const status = await fetchLatestPolicy();
        if (isMounted) {
          setPolicyStatus(status);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load policy.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPolicy();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Community Guidelines &amp; Terms</h1>
        {policyStatus?.policy && (
          <p className="text-sm text-gray-500 mb-6">
            Effective {new Date(policyStatus.policy.publishedAt).toLocaleDateString()} • Version{' '}
            {policyStatus.policy.version}
          </p>
        )}

        {loading && (
          <div className="py-8 text-center text-gray-500">Loading latest policy…</div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {policyStatus?.policy && (
          <div className="space-y-4 text-gray-700 leading-relaxed whitespace-pre-wrap">
            {policyStatus.policy.content.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        )}

        {!loading && !error && !policyStatus?.policy && (
          <div className="py-8 text-center text-gray-500">
            Policy content is currently unavailable. Please check back later.
          </div>
        )}
      </div>
    </div>
  );
}

export default Terms;


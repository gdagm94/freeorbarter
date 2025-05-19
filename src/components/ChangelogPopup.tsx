import React, { useState, useEffect } from 'react';
import { X, Bell, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Changelog {
  id: string;
  title: string;
  description: string;
  created_at: string;
  is_upcoming: boolean;
}

interface ChangelogPopupProps {
  onDismiss: () => void;
}

export function ChangelogPopup({ onDismiss }: ChangelogPopupProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [changelog, setChangelog] = useState<Changelog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestChangelog = async () => {
      try {
        // Get the latest changelog entry
        const { data, error } = await supabase
          .from('changelogs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setChangelog(data);
      } catch (err) {
        console.error('Error fetching changelog:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestChangelog();
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email }]);

      if (error) throw error;
      setSubscribeSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('Error subscribing to newsletter:', err);
    }
  };

  const handleDismiss = async () => {
    if (user && changelog) {
      try {
        // Record that this user has dismissed this changelog
        await supabase
          .from('changelog_dismissals')
          .insert([{
            user_id: user.id,
            changelog_id: changelog.id
          }])
          .maybeSingle();
      } catch (err) {
        console.error('Error recording changelog dismissal:', err);
      }
    }
    onDismiss();
  };

  if (loading || !changelog) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 sm:inset-auto sm:right-4 sm:bottom-4 sm:w-[420px] bg-white rounded-lg shadow-xl overflow-hidden z-50">
      <div className="relative">
        {/* Header */}
        <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-white" />
            <span className="ml-2 text-white font-medium">What's New</span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center flex-wrap gap-2">
            {changelog.title}
            {changelog.is_upcoming && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Coming Soon
              </span>
            )}
          </h3>
          <p className="mt-2 text-sm text-gray-600">{changelog.description}</p>

          {/* Newsletter Subscription */}
          <div className="mt-4 pt-4 border-t">
            <form onSubmit={handleSubscribe} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Subscribe to our newsletter
              </label>
              {subscribeSuccess ? (
                <p className="text-sm text-green-600">
                  Thanks for subscribing! 🎉
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center sm:justify-start whitespace-nowrap"
                  >
                    <span className="text-sm">Subscribe</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
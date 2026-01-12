import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ItemDetails from './pages/ItemDetails';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Messages from './pages/Messages';
import NewListing from './pages/NewListing';
import History from './pages/History';
import WatchedItemsPage from './pages/WatchedItemsPage';
import Notifications from './pages/Notifications';
import About from './pages/About';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import ResetPassword from './pages/ResetPassword';
import ConfirmEmail from './pages/ConfirmEmail';
import ModeratorDashboard from './pages/ModeratorDashboard';
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import { fetchLatestPolicy, PolicyStatus } from './lib/policy';
import { PolicyModal } from './components/PolicyModal';

function App() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOffers, setUnreadOffers] = useState(0);
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    const hasRecoveryHash = hash && hash.includes('type=recovery');
    const alreadyOnResetPage = window.location.pathname === '/reset-password';

    if (hasRecoveryHash && !alreadyOnResetPage) {
      const targetUrl = `${window.location.origin}/reset-password${hash}`;
      window.location.replace(targetUrl);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setUnreadOffers(0);
      return;
    }

    let isMounted = true;

    const fetchUnreadMessages = async () => {
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('is_offer')
          .eq('receiver_id', user.id)
          .eq('read', false);

        if (error) throw error;

        if (!isMounted) return;
        const totalUnread = messages?.length || 0;
        const unreadOffersCount = messages?.filter(msg => msg.is_offer)?.length || 0;

        setUnreadCount(totalUnread);
        setUnreadOffers(unreadOffersCount);
      } catch (err) {
        console.error('Error fetching unread messages:', err);
      }
    };

    fetchUnreadMessages();

    // Supabase realtime subscription for message changes
    const channel = supabase
      .channel(`messages-unread-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => fetchUnreadMessages()
      )
      .subscribe();

    // Lightweight fallback to guard against missed events
    const fallbackInterval = setInterval(fetchUnreadMessages, 60000);

    return () => {
      isMounted = false;
      channel.unsubscribe();
      clearInterval(fallbackInterval);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPolicyStatus(null);
      return;
    }

    let isMounted = true;
    const loadPolicy = async () => {
      try {
        const status = await fetchLatestPolicy();
        if (isMounted) {
          setPolicyStatus(status);
        }
      } catch (error) {
        console.error('Failed to load policy status', error);
      }
    };

    loadPolicy();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handlePolicyAccepted = async () => {
    try {
      const status = await fetchLatestPolicy();
      setPolicyStatus(status);
    } catch (error) {
      console.error('Failed to refresh policy status', error);
    }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar unreadCount={unreadCount} unreadOffers={unreadOffers} />
        <main className="container mx-auto px-4 py-8 max-w-7xl flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/items/:id" element={<ItemDetails />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/users/:id" element={<UserProfile />} />
            <Route 
              path="/messages" 
              element={
                <Messages 
                  onUnreadCountChange={setUnreadCount}
                  onUnreadOffersChange={setUnreadOffers}
                />
              } 
            />
            <Route path="/new-listing" element={<NewListing />} />
            <Route path="/history" element={<History />} />
            <Route path="/watched-items" element={<WatchedItemsPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/confirm-email" element={<ConfirmEmail />} />
            <Route path="/moderator" element={<ModeratorDashboard />} />
          </Routes>
        </main>
        <Footer />
        {user && policyStatus && !policyStatus.accepted && (
          <PolicyModal
            open
            policy={policyStatus.policy}
            onAccepted={handlePolicyAccepted}
            onLogoutRequested={() => supabase.auth.signOut()}
          />
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
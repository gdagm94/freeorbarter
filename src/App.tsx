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
import Notifications from './pages/Notifications';
import About from './pages/About';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import ResetPassword from './pages/ResetPassword';
import ConfirmEmail from './pages/ConfirmEmail';
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import pusherClient from './lib/pusher';

function App() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOffers, setUnreadOffers] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setUnreadOffers(0);
      return;
    }

    // Initial fetch of unread messages
    const fetchUnreadMessages = async () => {
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('is_offer')
          .eq('receiver_id', user.id)
          .eq('read', false);

        if (error) throw error;

        const totalUnread = messages?.length || 0;
        const unreadOffers = messages?.filter(msg => msg.is_offer)?.length || 0;

        setUnreadCount(totalUnread);
        setUnreadOffers(unreadOffers);
      } catch (err) {
        console.error('Error fetching unread messages:', err);
      }
    };

    fetchUnreadMessages();

    // Subscribe to new messages
    const channel = pusherClient.subscribe(`private-user-${user.id}`);

    channel.bind('new-message', async () => {
      // Refetch unread counts when new message arrives
      await fetchUnreadMessages();
    });

    channel.bind('message-read', async () => {
      // Refetch unread counts when messages are marked as read
      await fetchUnreadMessages();
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [user]);

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
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/confirm-email" element={<ConfirmEmail />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
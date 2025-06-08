import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, PlusCircle, User, BarChart2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Auth } from './Auth';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../hooks/useAuth';

interface NavbarProps {
  unreadCount: number;
  unreadOffers: number;
}

function Navbar({ unreadCount, unreadOffers }: NavbarProps) {
  const { user, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleUploadClick = () => {
    if (user) {
      navigate('/new-listing');
    } else {
      setShowAuth(true);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Calculate total unread count (messages + offers)
  const totalUnread = unreadCount;

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <BarChart2 className="w-8 h-8 text-indigo-600" />
              <span className="text-xl font-bold text-indigo-600">FreeorBarter</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link to="/messages" className="nav-link relative">
                    <div className="relative">
                      <MessageCircle className="w-6 h-6" />
                      {totalUnread > 0 && (
                        <div className="absolute -top-2 -right-2">
                          <span className="flex h-5 w-5">
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500">
                              <span className="absolute inset-0 flex items-center justify-center text-xs text-white">
                                {totalUnread > 9 ? '9+' : totalUnread}
                              </span>
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="hidden md:block">Messages</span>
                  </Link>
                  <Link to="/new-listing" className="nav-link">
                    <PlusCircle className="w-6 h-6" />
                    <span className="hidden md:block">New Listing</span>
                  </Link>
                  <NotificationBell />
                  <Link to="/profile" className="nav-link">
                    <User className="w-6 h-6" />
                    <span className="hidden md:block">Profile</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="nav-link"
                    title="Sign Out"
                  >
                    <LogOut className="w-6 h-6" />
                    <span className="hidden md:block">Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleUploadClick}
                  className="btn-primary flex items-center space-x-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Upload</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </nav>
  );
}

export default Navbar;
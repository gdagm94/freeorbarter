import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { WatchedItems } from '../components/WatchedItems';

function WatchedItemsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Please sign in to view your watchlist</h1>
        <p className="text-gray-600">You need to be logged in to access your watched items.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-indigo-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold flex items-center">
            <Star className="w-6 h-6 mr-2 text-yellow-500" />
            My Watchlist
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <WatchedItems userId={user.id} />
      </div>
    </div>
  );
}

export default WatchedItemsPage;
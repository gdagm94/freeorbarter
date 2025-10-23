import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, Calendar, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  sender: {
    username: string;
    avatar_url: string | null;
  };
  items?: {
    id: string;
    title: string;
  };
}

interface MessageSearchProps {
  currentUserId: string;
  otherUserId: string;
  conversationType: 'item' | 'direct_message' | 'unified';
  itemId?: string | null;
  onResultClick?: (messageId: string) => void;
}

export function MessageSearch({ 
  currentUserId, 
  otherUserId, 
  conversationType, 
  itemId, 
  onResultClick 
}: MessageSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMessages = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setLoading(true);
      setHasSearched(true);

      let query = supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender:sender_id (
            username,
            avatar_url
          ),
          items:item_id (
            id,
            title
          )
        `)
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
        .textSearch('content', searchQuery, {
          type: 'websearch',
          config: 'english'
        })
        .order('created_at', { ascending: false })
        .limit(20);

      // Apply conversation type filters
      if (conversationType === 'direct_message') {
        query = query.is('item_id', null);
      } else if (conversationType === 'item' && itemId) {
        query = query.eq('item_id', itemId);
      }
      // For unified conversations, no additional filter needed

      const { data, error } = await query;

      if (error) {
        console.error('Error searching messages:', error);
        setResults([]);
        return;
      }

      setResults(data || []);
    } catch (err) {
      console.error('Error in searchMessages:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchMessages(query);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setIsOpen(false);
  };

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div className="relative">
      {/* Search Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
        title="Search messages"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Search Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={clearSearch}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Searching...</p>
              </div>
            ) : hasSearched ? (
              results.length > 0 ? (
                <div className="p-2">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        if (onResultClick) {
                          onResultClick(result.id);
                        }
                        clearSearch();
                      }}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                          {result.sender.avatar_url ? (
                            <img 
                              src={result.sender.avatar_url} 
                              alt={result.sender.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-600">
                              {result.sender.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {result.sender.username}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(result.created_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          {result.items && (
                            <div className="flex items-center gap-1 mb-1">
                              <MessageSquare className="w-3 h-3 text-indigo-500" />
                              <span className="text-xs text-indigo-600">
                                About: {result.items.title}
                              </span>
                            </div>
                          )}
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {highlightText(result.content, query)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No messages found</p>
                  <p className="text-xs">Try different keywords</p>
                </div>
              )
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Search your messages</p>
                <p className="text-xs">Enter keywords to find specific messages</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

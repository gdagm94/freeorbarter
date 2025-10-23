import React, { useState, useEffect } from 'react';
import { FileText, X, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface MessageDraft {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface MessageDraftsProps {
  currentUserId: string;
  otherUserId: string;
  conversationType: 'item' | 'direct_message' | 'unified';
  itemId?: string | null;
  onDraftSelect?: (draft: MessageDraft) => void;
  onDraftDelete?: (draftId: string) => void;
}

export function MessageDrafts({ 
  currentUserId, 
  otherUserId, 
  conversationType, 
  itemId, 
  onDraftSelect,
  onDraftDelete 
}: MessageDraftsProps) {
  const [drafts, setDrafts] = useState<MessageDraft[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDrafts();
    }
  }, [isOpen, currentUserId, otherUserId, conversationType, itemId]);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      
      // For now, we'll use localStorage to store drafts
      // In a real implementation, you might want to store these in the database
      const draftKey = `draft_${currentUserId}_${otherUserId}_${conversationType}_${itemId || 'unified'}`;
      const savedDrafts = localStorage.getItem(draftKey);
      
      if (savedDrafts) {
        const parsedDrafts = JSON.parse(savedDrafts);
        setDrafts(parsedDrafts);
      } else {
        setDrafts([]);
      }
    } catch (err) {
      console.error('Error fetching drafts:', err);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = (content: string) => {
    if (!content.trim()) return;

    try {
      const draftKey = `draft_${currentUserId}_${otherUserId}_${conversationType}_${itemId || 'unified'}`;
      const newDraft: MessageDraft = {
        id: Date.now().toString(),
        content: content.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const updatedDrafts = [newDraft, ...drafts].slice(0, 5); // Keep only 5 most recent drafts
      localStorage.setItem(draftKey, JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);
    } catch (err) {
      console.error('Error saving draft:', err);
    }
  };

  const deleteDraft = (draftId: string) => {
    try {
      const draftKey = `draft_${currentUserId}_${otherUserId}_${conversationType}_${itemId || 'unified'}`;
      const updatedDrafts = drafts.filter(draft => draft.id !== draftId);
      localStorage.setItem(draftKey, JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);
      
      if (onDraftDelete) {
        onDraftDelete(draftId);
      }
    } catch (err) {
      console.error('Error deleting draft:', err);
    }
  };

  const selectDraft = (draft: MessageDraft) => {
    if (onDraftSelect) {
      onDraftSelect(draft);
    }
    setIsOpen(false);
  };

  const clearAllDrafts = () => {
    try {
      const draftKey = `draft_${currentUserId}_${otherUserId}_${conversationType}_${itemId || 'unified'}`;
      localStorage.removeItem(draftKey);
      setDrafts([]);
    } catch (err) {
      console.error('Error clearing drafts:', err);
    }
  };

  if (drafts.length === 0 && !isOpen) {
    return null;
  }

  return (
    <div className="relative">
      {/* Drafts Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors relative"
        title="Saved drafts"
      >
        <FileText className="w-5 h-5" />
        {drafts.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {drafts.length}
          </span>
        )}
      </button>

      {/* Drafts Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Saved Drafts</h3>
              {drafts.length > 0 && (
                <button
                  onClick={clearAllDrafts}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading drafts...</p>
              </div>
            ) : drafts.length > 0 ? (
              <div className="p-2">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="p-3 border border-gray-200 rounded-lg mb-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                          {draft.content}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>
                            {format(new Date(draft.updated_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => selectDraft(draft)}
                          className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No saved drafts</p>
                <p className="text-xs">Start typing to save a draft</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for managing message drafts
export function useMessageDrafts(
  currentUserId: string,
  otherUserId: string,
  conversationType: 'item' | 'direct_message' | 'unified',
  itemId?: string | null
) {
  const saveDraft = (content: string) => {
    if (!content.trim()) return;

    try {
      const draftKey = `draft_${currentUserId}_${otherUserId}_${conversationType}_${itemId || 'unified'}`;
      const newDraft: MessageDraft = {
        id: Date.now().toString(),
        content: content.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const existingDrafts = localStorage.getItem(draftKey);
      const drafts = existingDrafts ? JSON.parse(existingDrafts) : [];
      const updatedDrafts = [newDraft, ...drafts].slice(0, 5);
      
      localStorage.setItem(draftKey, JSON.stringify(updatedDrafts));
    } catch (err) {
      console.error('Error saving draft:', err);
    }
  };

  const clearDrafts = () => {
    try {
      const draftKey = `draft_${currentUserId}_${otherUserId}_${conversationType}_${itemId || 'unified'}`;
      localStorage.removeItem(draftKey);
    } catch (err) {
      console.error('Error clearing drafts:', err);
    }
  };

  return { saveDraft, clearDrafts };
}

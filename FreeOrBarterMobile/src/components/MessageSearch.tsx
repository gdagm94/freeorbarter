import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  sender: {
    username: string;
  };
}

interface MessageSearchProps {
  currentUserId: string;
  otherUserId: string;
  conversationType: 'item' | 'direct_message' | 'unified';
  itemId?: string | null;
  onResultClick: (messageId: string) => void;
}

export function MessageSearch({ 
  currentUserId, 
  otherUserId, 
  conversationType, 
  itemId, 
  onResultClick 
}: MessageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchMessages = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    try {
      setLoading(true);
      
      let supabaseQuery = supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender:sender_id (
            username
          )
        `)
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      // Apply conversation type filter
      if (conversationType === 'item' && itemId) {
        supabaseQuery = supabaseQuery.eq('item_id', itemId);
      } else if (conversationType === 'direct_message') {
        supabaseQuery = supabaseQuery.is('item_id', null);
      }

      const { data, error } = await supabaseQuery;

      if (error) {
        console.error('Error searching messages:', error);
        return;
      }

      setSearchResults((data || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        sender: { username: msg.sender?.username || 'Unknown' }
      })));
      setShowResults(true);
    } catch (err) {
      console.error('Error in searchMessages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim()) {
      searchMessages(text);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleResultPress = (messageId: string) => {
    onResultClick(messageId);
    setShowResults(false);
    setSearchQuery('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <Text key={index} style={styles.highlightedText}>{part}</Text>
      ) : (
        <Text key={index}>{part}</Text>
      )
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => setShowResults(true)}
      >
        <Text style={styles.searchIcon}>🔍</Text>
      </TouchableOpacity>

      <Modal
        visible={showResults}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResults(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.searchModal}>
            <View style={styles.searchHeader}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search messages..."
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoFocus={true}
              />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowResults(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                style={styles.resultsList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => handleResultPress(item.id)}
                  >
                    <Text style={styles.resultContent}>
                      {highlightText(item.content, searchQuery)}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {item.sender.username} • {formatDate(item.created_at)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            ) : searchQuery.trim() ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No messages found</Text>
              </View>
            ) : (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>Start typing to search messages</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
  },
  searchButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  searchIcon: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  searchModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
    paddingTop: 20,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  closeButton: {
    marginLeft: 12,
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
  },
  resultsList: {
    maxHeight: 400,
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resultContent: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  highlightedText: {
    backgroundColor: '#FEF3C7',
    fontWeight: '600',
  },
  resultMeta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});

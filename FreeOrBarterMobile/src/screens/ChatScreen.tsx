// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Message } from '../types';
import * as Haptics from 'expo-haptics';
import { useDeviceInfo } from '../hooks/useDeviceInfo';
import { useResponsiveStyles, getResponsivePadding } from '../utils/responsive';
import { SwipeToReply } from '../components/SwipeToReply';
import { MessageReactions } from '../components/MessageReactions';
import { ReadReceipt } from '../components/ReadReceipt';
import { MessageSearch } from '../components/MessageSearch';
import { MessageDrafts, useMessageDrafts } from '../components/MessageDrafts';
import { FileAttachment } from '../components/FileAttachment';
import { VoiceMessage } from '../components/VoiceMessage';
import { VoiceMessagePlayer } from '../components/VoiceMessagePlayer';
import { AttachmentMenu } from '../components/AttachmentMenu';
import { FileDisplay } from '../components/FileDisplay';
import { ImageViewer } from '../components/ImageViewer';
import { checkContent } from '../lib/contentFilter';
import { FileViewer } from '../components/FileViewer';
import { OfferTemplates } from '../components/OfferTemplates';
import { BulkOffers } from '../components/BulkOffers';
import { CounterOffers } from '../components/CounterOffers';
import { MessageContextMenu } from '../components/MessageContextMenu';
import {
  ReportContentSheet,
  ReportTargetPayload,
} from '../components/ReportContentSheet';
import { useBlockStatus } from '../hooks/useBlockStatus';
import { blockUserWithCleanup, unblockUserPair } from '../lib/blocks';

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [offerActionLoading, setOfferActionLoading] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<{username: string; avatar_url: string | null} | null>(null);
  const [replyingTo, setReplyingTo] = useState<{id: string; content: string; senderName: string} | null>(null);
  const [showFileAttachment, setShowFileAttachment] = useState(false);
  const [showVoiceMessage, setShowVoiceMessage] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [lastTap, setLastTap] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{url: string; name: string; type: string; size?: number} | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showOfferTemplates, setShowOfferTemplates] = useState(false);
  const [showBulkOffers, setShowBulkOffers] = useState(false);
  const [showCounterOffers, setShowCounterOffers] = useState<string | null>(null);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTargetPayload | null>(null);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [blockActionLoading, setBlockActionLoading] = useState(false);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { otherUserId, itemId } = route.params || {};
  const [threadId, setThreadId] = useState<string | null>(null);
  const threadChannelRef = useRef<any>(null);
  const lastThreadCreateFailure = useRef<number | null>(null);
  const threadCreationDisabledRef = useRef<boolean>(false);
  const getTopic = () => (itemId ? 'item' : 'direct');
  const {
    blockedByMe,
    blockedByOther,
    isEitherBlocked,
    refresh: refreshBlockStatus,
  } = useBlockStatus(user?.id, otherUserId);
  const chatDisabledMessage = blockedByMe
    ? 'You blocked this user. Unblock to chat again.'
    : blockedByOther
      ? 'This user has blocked you.'
      : null;
  const canSendMessages = Boolean(user && otherUserId && !isEitherBlocked);
  const flatListRef = useRef<FlatList>(null);
  
  // Message drafts hook
  const { saveDraft, clearDrafts } = useMessageDrafts(
    user?.id || '',
    otherUserId,
    itemId ? 'item' : 'direct_message',
    itemId
  );

  useEffect(() => {
    if (!otherUserId || !user) return;
    let isMounted = true;
    const init = async () => {
      const ensured = await ensureThread();
      await fetchMessages(ensured || undefined);
      fetchOtherUser();
    };
    init();

    return () => {
      isMounted = false;
      if (threadChannelRef.current) {
        supabase.removeChannel(threadChannelRef.current);
        threadChannelRef.current = null;
      }
    };
  }, [otherUserId, user?.id]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (otherUserId && user) {
        fetchMessages();
        fetchOtherUser();
      }
    });
    return unsubscribe;
  }, [navigation, otherUserId, user]);

  const fetchOtherUser = async () => {
    if (!otherUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, avatar_url')
        .eq('id', otherUserId)
        .single();
      
      if (error) throw error;
      setOtherUser(data);
    } catch (error) {
      console.error('Error fetching other user:', error);
    }
  };

  const ensureThread = async (): Promise<string | null> => {
    if (!user || !otherUserId) return null;
    if (threadId) return threadId;
    if (threadCreationDisabledRef.current) {
      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H5',location:'ChatScreen.tsx:ensureThread:disabled',message:'thread creation disabled - skipping',data:{userId:user.id, otherUserId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return null;
    }
    const now = Date.now();
    if (lastThreadCreateFailure.current && now - lastThreadCreateFailure.current < 30000) {
      return null; // back off for 30s after a failure
    }

    try {
      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H4',location:'ChatScreen.tsx:ensureThread:start',message:'ensureThread entry',data:{threadId, userId:user.id, otherUserId, itemId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // Look for existing thread via recent messages with thread_id
      const { data: existingMessages, error: existingError } = await supabase
        .from('messages')
        .select('thread_id')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        )
        .not('thread_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'ChatScreen.tsx:ensureThread:existingQuery',message:'existing thread query result',data:{hasError:Boolean(existingError), firstThreadId:existingMessages?.[0]?.thread_id ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!existingError && existingMessages && existingMessages.length > 0 && existingMessages[0].thread_id) {
        const existingId = existingMessages[0].thread_id;
        setThreadId(existingId);
        lastThreadCreateFailure.current = null;
        await ensureThreadMembers(existingId);
        subscribeToThread(existingId);
        return existingId;
      }

      // Skip creating a new thread if none exists; operate without thread_id to avoid RLS failures
      threadCreationDisabledRef.current = true;
      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H5',location:'ChatScreen.tsx:ensureThread:skipCreation',message:'no existing thread; skipping creation to avoid RLS',data:{userId:user.id, otherUserId, itemId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return null;
    } catch (error) {
      console.error('Error ensuring thread:', error);
      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'ChatScreen.tsx:ensureThread:catch',message:'ensureThread error',data:{error: (error as any)?.message || String(error)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H5',location:'ChatScreen.tsx:ensureThread:rlsFallback',message:'disabling thread creation after error',data:{error: (error as any)?.message || String(error)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      threadCreationDisabledRef.current = true;
      lastThreadCreateFailure.current = Date.now();
    }
    return null;
  };

  const ensureThreadMembers = async (id: string) => {
    try {
      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'ChatScreen.tsx:ensureThreadMembers:start',message:'ensureThreadMembers upsert',data:{threadId:id, userId:user?.id, otherUserId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await supabase
        .from('thread_members')
        .upsert(
          [
            { thread_id: id, user_id: user?.id },
            { thread_id: id, user_id: otherUserId },
          ],
          { onConflict: 'thread_id,user_id' }
        );
    } catch (error) {
      console.error('Error ensuring thread members:', error);
      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'ChatScreen.tsx:ensureThreadMembers:catch',message:'ensureThreadMembers error',data:{threadId:id, error: (error as any)?.message || String(error)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
  };

  const subscribeToThread = (id: string) => {
    if (threadChannelRef.current) {
      supabase.removeChannel(threadChannelRef.current);
      threadChannelRef.current = null;
    }

    threadChannelRef.current = supabase
      .channel(`room:${id}:messages`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${id}` },
        () => fetchMessages(id)
      )
      .subscribe();
  };

  const fetchMessages = async (existingThreadId?: string) => {
    if (!otherUserId || !user) return;

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (existingThreadId || threadId) {
        query = query.eq('thread_id', existingThreadId || threadId);
      } else {
        query = query.or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      // Mark messages from other user as read
      const all = (data as Message[]) || [];
      const unreadFromOther = all.filter(m => m.receiver_id === user.id && !m.read);
      if (unreadFromOther.length > 0) {
        try {
          let readQuery = supabase
            .from('messages')
            .update({ read: true })
            .eq('sender_id', otherUserId)
            .eq('receiver_id', user.id)
            .eq('read', false);

          if (existingThreadId || threadId) {
            readQuery = readQuery.eq('thread_id', existingThreadId || threadId);
          }

          await readQuery;
        } catch {}
      }
      setMessages(all);
      const thread = existingThreadId || all.find(m => m.thread_id)?.thread_id || null;
      if (thread && threadId !== thread) {
        setThreadId(thread);
        await ensureThreadMembers(thread);
        subscribeToThread(thread);
      } else if (!thread && !threadId && !threadCreationDisabledRef.current) {
        // no thread yet; create one
        const created = await ensureThread();
        if (created) {
          subscribeToThread(created);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMessageLongPress = (message: Message) => {
    setContextMenuMessage(message);
    setShowContextMenu(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReportMessage = (message: Message) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to report messages.');
      return;
    }

    setReportTarget({
      type: 'message',
      id: message.id,
      displayName: `Message from ${
        message.sender_id === user.id ? 'you' : otherUser?.username || 'this user'
      }`,
      metadata: {
        item_id: message.item_id,
        snippet: message.content?.slice(0, 280),
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
      },
    });
  };

  const handleReportUserFromChat = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to report users.');
      return;
    }

    if (!otherUserId) {
      Alert.alert('Unable to report user', 'We could not find this user.');
      return;
    }

    setReportTarget({
      type: 'user',
      id: otherUserId,
      displayName: otherUser?.username,
      metadata: {
        fromScreen: 'Chat',
        item_id: itemId,
      },
    });
  };

  const handleBlockConversation = () => {
    if (!user || !otherUserId) {
      Alert.alert('Unavailable', 'Unable to block this user right now.');
      return;
    }

    Alert.alert(
      'Block user',
      `Block ${otherUser?.username || 'this user'}? You will stop seeing their content and any open offers will be closed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              setBlockActionLoading(true);
              await blockUserWithCleanup({ blockerId: user.id, blockedId: otherUserId });
              await refreshBlockStatus();
              Alert.alert('User blocked', 'Messaging has been disabled.');
            } catch (error) {
              console.error('Error blocking user from chat:', error);
              Alert.alert('Error', 'Failed to block user.');
            } finally {
              setBlockActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleUnblockConversation = () => {
    if (!user || !otherUserId) return;

    Alert.alert('Unblock user', `Allow ${otherUser?.username || 'this user'} to contact you again?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            setBlockActionLoading(true);
            await unblockUserPair({ blockerId: user.id, blockedId: otherUserId });
            await refreshBlockStatus();
            Alert.alert('User unblocked', 'You can chat again.');
          } catch (error) {
            console.error('Error unblocking user from chat:', error);
            Alert.alert('Error', 'Failed to unblock user.');
          } finally {
            setBlockActionLoading(false);
          }
        },
      },
    ]);
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setUploading(true);
      
      // Create FormData for React Native file upload
      const formData = new FormData();
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Add file to FormData with proper structure for React Native
      formData.append('file', {
        uri: uri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any);

      console.log('Attempting to upload image:', fileName);
      console.log('File URI:', uri);

      // Upload using FormData instead of blob
      const { error: uploadError, data } = await supabase.storage
        .from('message-images')
        .upload(fileName, formData, {
          contentType: `image/${fileExt}`,
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        Alert.alert('Upload Error', `Failed to upload image: ${uploadError.message}`);
        return null;
      }
      
      console.log('Upload successful:', data);
      const { data: { publicUrl } } = supabase.storage
        .from('message-images')
        .getPublicUrl(fileName);
      console.log('Public URL:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    try {
      console.log('Requesting media library permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to attach photos');
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('Image selected:', result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const imageUrl = await uploadImage(result.assets[0].uri);
        if (imageUrl) {
          await sendMessage('', imageUrl);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', `Failed to pick image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const takePhoto = async () => {
    try {
      console.log('Requesting camera permissions...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('Camera permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to take photos');
        return;
      }

      console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('Photo taken:', result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const imageUrl = await uploadImage(result.assets[0].uri);
        if (imageUrl) {
          await sendMessage('', imageUrl);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', `Failed to take photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Attach Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const sendMessage = async (content?: string, imageUrl?: string) => {
    const messageContent = content || newMessage.trim();
    if (!messageContent && !imageUrl) return;
    if (!user || !otherUserId) return;
     if (isEitherBlocked) {
       Alert.alert('Messaging disabled', 'You cannot send messages when a block is in place.');
       return;
     }

    // Check content filtering for text messages
    if (messageContent) {
      try {
        const filterResult = await checkContent({
          content: messageContent,
          contentType: 'message',
        });

        if (filterResult.blocked) {
          Alert.alert(
            'Content Not Allowed',
            filterResult.message || 'Your message contains inappropriate content and cannot be sent.'
          );
          return;
        }

        if (filterResult.warned) {
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Content Warning',
              filterResult.message || 'Your message may contain inappropriate content. Do you want to proceed?',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Proceed', onPress: () => resolve(true) },
              ]
            );
          });

          if (!proceed) {
            return;
          }
        }
      } catch (err) {
        console.error('Error checking content:', err);
        // Continue with sending if filter check fails
      }
    }

    try {
      const activeThreadId = threadId || (await ensureThread());

      const messageData: Partial<Message> = {
        sender_id: user.id,
        receiver_id: otherUserId,
        content: messageContent,
        item_id: itemId || null,
        image_url: imageUrl || null,
        thread_id: activeThreadId || null,
        topic: getTopic(),
      } as any;

      // #region agent log
      fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'H6',location:'ChatScreen.tsx:sendMessage:beforeInsert',message:'sendMessage inserting',data:{hasContent:Boolean(messageContent), hasImage:Boolean(imageUrl), topic:messageData.topic, threadId:messageData.thread_id},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const { error } = await supabase
        .from('messages')
        .insert([messageData]);

      if (error) {
        console.error('Error sending message:', error);
        // #region agent log
        fetch('http://10.0.0.207:7242/ingest/7324c825-d016-44a1-91f7-2f773ba2ff20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'H6',location:'ChatScreen.tsx:sendMessage:insertError',message:'sendMessage insert error',data:{errorMessage:error.message, code:(error as any)?.code},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      }

      setNewMessage('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleOfferAction = async (messageId: string, offerId: string, action: 'accept' | 'decline') => {
    setOfferActionLoading(messageId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Update the barter offer status
      const { error: offerError } = await supabase
        .from('barter_offers')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', offerId);

      if (offerError) throw offerError;

      // Send a system message about the action
      const actionMessage = action === 'accept' 
        ? '✅ Barter offer accepted!' 
        : '❌ Barter offer declined';
      
      await supabase
        .from('messages')
        .insert([{
          sender_id: user!.id,
          receiver_id: otherUserId,
          content: actionMessage,
          item_id: itemId || null,
          is_offer: false,
          read: false,
          topic: getTopic(),
        }]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Offer ${action}ed successfully`);
      
      // Refresh messages
      await fetchMessages();

    } catch (error) {
      console.error(`Error ${action}ing offer:`, error);
      Alert.alert('Error', `Failed to ${action} offer`);
    } finally {
      setOfferActionLoading(null);
    }
  };

  const handleReply = (messageId: string, content: string, senderName: string) => {
    setReplyingTo({ id: messageId, content, senderName });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const sendReply = async () => {
    if (!replyingTo || !newMessage.trim()) return;
    if (isEitherBlocked) {
      Alert.alert('Messaging disabled', 'You cannot reply while a block is active.');
      return;
    }

    try {
      const replyContent = `Replying to "${replyingTo.content}": ${newMessage.trim()}`;
      
      const { error } = await supabase
        .from('messages')
        .insert([{
          sender_id: user!.id,
          receiver_id: otherUserId,
          content: replyContent,
          item_id: itemId || null,
          read: false,
          is_offer: false,
          topic: getTopic(),
        }]);

      if (error) {
        console.error('Error sending reply:', error);
        Alert.alert('Error', 'Failed to send reply');
        return;
      }

      setNewMessage('');
      setReplyingTo(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      fetchMessages();
    } catch (error) {
      console.error('Error in sendReply:', error);
      Alert.alert('Error', 'Failed to send reply');
    }
  };

  // New handler functions for advanced features
  const handleSearchResultClick = (messageId: string) => {
    setHighlightedMessageId(messageId);
    // Scroll to message
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1) {
      flatListRef.current?.scrollToIndex({ index: messageIndex, animated: true });
    }
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedMessageId(null), 3000);
  };

  const handleDraftSelect = (content: string) => {
    setNewMessage(content);
  };

  const handleFileUpload = async (fileUrl: string, fileName: string, fileType: string) => {
    if (!user || !otherUserId || isEitherBlocked) {
      Alert.alert('Messaging disabled', 'You cannot share files while a block is active.');
      return;
    }
    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          sender_id: user!.id,
          receiver_id: otherUserId,
          content: `📎 ${fileName}`,
          file_url: fileUrl,
          item_id: itemId || null,
          read: false,
          is_offer: false,
          topic: getTopic(),
        }]);

      if (error) {
        console.error('Error sending file:', error);
        Alert.alert('Error', 'Failed to send file');
        return;
      }

      setShowFileAttachment(false);
      fetchMessages();
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
      Alert.alert('Error', 'Failed to send file');
    }
  };

  const handleVoiceMessageUpload = async (audioUri: string, duration: number) => {
    if (!user || !otherUserId || isEitherBlocked) {
      Alert.alert('Messaging disabled', 'You cannot send voice messages while a block is active.');
      return;
    }
    try {
      setUploading(true);

      // Read the file from URI
      const response = await fetch(audioUri);
      const arrayBuffer = await response.arrayBuffer();

      // Create a unique filename
      const fileName = `voice_${Date.now()}.m4a`;
      const filePath = `message-files/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('message-files')
        .upload(filePath, arrayBuffer, {
          contentType: 'audio/m4a',
        });

      if (error) {
        console.error('Error uploading voice message:', error);
        Alert.alert('Error', 'Failed to upload voice message');
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('message-files')
        .getPublicUrl(filePath);

      // Insert message
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          sender_id: user!.id,
          receiver_id: otherUserId,
          content: `🎤 Voice message (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
          file_url: urlData.publicUrl,
          item_id: itemId || null,
          read: false,
          is_offer: false,
          topic: getTopic(),
        }]);

      if (messageError) {
        console.error('Error sending voice message:', messageError);
        Alert.alert('Error', 'Failed to send voice message');
        return;
      }

      setShowVoiceMessage(false);
      fetchMessages();
    } catch (error) {
      console.error('Error in handleVoiceMessageUpload:', error);
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setUploading(false);
    }
  };

  const handleDoubleTap = (messageId: string) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // Double tap detected - show emoji picker
      setShowReactionPicker(messageId);
    } else {
      setLastTap(now);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const isOffer = item.is_offer && item.offer_item_id;
    const senderName = isOwnMessage ? 'You' : (otherUser?.username || 'Unknown');

    const messageContent = (
      <View style={isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper}>
        {/* Timestamp above message */}
        <Text style={[
          styles.messageTime,
          isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
        ]}>
          {new Date(item.created_at).toLocaleTimeString()}
        </Text>
        
        <TouchableOpacity
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
            isOffer && styles.offerMessage
          ]}
          onPress={() => handleDoubleTap(item.id)}
          onLongPress={() => handleMessageLongPress(item)}
          delayLongPress={200}
          activeOpacity={0.7}
        >
        {item.image_url && (
          <TouchableOpacity 
            style={styles.messageImageContainer}
            onPress={() => {
              if (item.image_url) {
                setSelectedImageUrl(item.image_url);
                setShowImageViewer(true);
              }
            }}
          >
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        {item.content && (
        <Text style={[
          styles.messageText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
          isOffer && styles.offerMessageText
        ]}>
          {item.content}
        </Text>
        )}
        
        {/* File Display for non-image files */}
        {(item as any).file_url && !item.image_url && !item.content?.includes('🎤') && (
          <FileDisplay
            fileUrl={(item as any).file_url}
            fileName={(item as any).file_name || 'Unknown file'}
            fileType={(item as any).file_type || 'unknown'}
            fileSize={(item as any).file_size}
            onPress={() => {
              setSelectedFile({
                url: (item as any).file_url,
                name: (item as any).file_name || 'Unknown file',
                type: (item as any).file_type || 'unknown',
                size: (item as any).file_size
              });
              setShowFileViewer(true);
            }}
          />
        )}
        
        {/* Barter Offer Actions - Only show for received offers */}
        {isOffer && !isOwnMessage && (
          <View style={styles.offerActions}>
            <TouchableOpacity
              style={[styles.offerButton, styles.acceptButton]}
              onPress={() => {
                // We need the offer ID - let's fetch it
                Alert.alert(
                  'Accept Offer',
                  'Are you sure you want to accept this barter offer?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Accept',
                      onPress: async () => {
                        // Find the offer by message details
                        const { data: offers } = await supabase
                          .from('barter_offers')
                          .select('id')
                          .eq('offered_item_id', item.offer_item_id!)
                          .eq('requested_item_id', item.item_id)
                          .eq('sender_id', item.sender_id)
                          .eq('status', 'pending')
                          .limit(1);
                        
                        if (offers && offers.length > 0) {
                          handleOfferAction(item.id, offers[0].id, 'accept');
                        }
                      }
                    }
                  ]
                );
              }}
              disabled={offerActionLoading === item.id}
            >
              <Text style={styles.acceptButtonText}>✓ Accept</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.offerButton, styles.declineButton]}
              onPress={async () => {
                // Find the offer by message details
                const { data: offers } = await supabase
                  .from('barter_offers')
                  .select('id')
                  .eq('offered_item_id', item.offer_item_id!)
                  .eq('requested_item_id', item.item_id)
                  .eq('sender_id', item.sender_id)
                  .eq('status', 'pending')
                  .limit(1);
                
                if (offers && offers.length > 0) {
                  handleOfferAction(item.id, offers[0].id, 'decline');
                }
              }}
              disabled={offerActionLoading === item.id}
            >
              <Text style={styles.declineButtonText}>✕ Decline</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Timestamp moved to be positioned above message bubble */}
        
        {/* Message Reactions - Only show if they exist */}
        <MessageReactions
          messageId={item.id}
          currentUserId={user?.id || ''}
        />
        
        {/* Read Receipt */}
        <ReadReceipt
          message={item}
          currentUserId={user?.id || ''}
        />
        
        {/* Voice Message Player */}
        {(item as any).file_url && item.content?.includes('🎤') && (
          <VoiceMessagePlayer
            audioUrl={(item as any).file_url}
            duration={0} // TODO: Store duration in DB
            isOwnMessage={isOwnMessage}
          />
        )}
        </TouchableOpacity>
      </View>
    );

    // Only allow swiping to reply for messages from other users
    if (!isOwnMessage) {
      return (
        <SwipeToReply
          messageId={item.id}
          messageContent={item.content || ''}
          senderName={senderName}
          onReply={handleReply}
        >
          {messageContent}
        </SwipeToReply>
      );
    }

    return messageContent;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButtonContainer}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
          >
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerUserContainer}
            onPress={() => {
              if (otherUserId) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('UserProfile', { userId: otherUserId });
              }
            }}
            activeOpacity={0.7}
          >
            {otherUser?.avatar_url ? (
              <Image 
                source={{ uri: otherUser.avatar_url }} 
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>👤</Text>
              </View>
            )}
            <Text style={styles.title} numberOfLines={1}>
              {otherUser?.username || 'Loading...'}
            </Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <MessageSearch
              currentUserId={user?.id || ''}
              otherUserId={otherUserId}
              conversationType={itemId ? 'item' : 'direct_message'}
              itemId={itemId}
              onResultClick={handleSearchResultClick}
            />
            <MessageDrafts
              currentUserId={user?.id || ''}
              otherUserId={otherUserId}
              conversationType={itemId ? 'item' : 'direct_message'}
              itemId={itemId}
              onDraftSelect={handleDraftSelect}
            />
            <TouchableOpacity
              style={styles.safetyButton}
              onPress={() => setShowSafetyMenu(true)}
              accessibilityLabel="Open safety menu"
            >
              <Text style={styles.safetyButtonText}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <KeyboardAvoidingView 
        style={styles.keyboardContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButtonContainer}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
          >
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerUserContainer}
            onPress={() => {
              if (otherUserId) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('UserProfile', { userId: otherUserId });
              }
            }}
            activeOpacity={0.7}
          >
            {otherUser?.avatar_url ? (
              <Image 
                source={{ uri: otherUser.avatar_url }} 
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>👤</Text>
              </View>
            )}
            <Text style={styles.title} numberOfLines={1}>
              {otherUser?.username || 'Chat'}
            </Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <MessageSearch
              currentUserId={user?.id || ''}
              otherUserId={otherUserId}
              conversationType={itemId ? 'item' : 'direct_message'}
              itemId={itemId}
              onResultClick={handleSearchResultClick}
            />
            <MessageDrafts
              currentUserId={user?.id || ''}
              otherUserId={otherUserId}
              conversationType={itemId ? 'item' : 'direct_message'}
              itemId={itemId}
              onDraftSelect={handleDraftSelect}
            />
          </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item: Message) => item.id}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Start the conversation by sending a message
            </Text>
          </View>
        }
      />

      {chatDisabledMessage && (
        <View style={styles.blockNotice}>
          <Text style={styles.blockNoticeText}>{chatDisabledMessage}</Text>
          {blockedByMe && (
            <TouchableOpacity
              style={styles.blockNoticeAction}
              onPress={handleUnblockConversation}
            >
              <Text style={styles.blockNoticeActionText}>Unblock</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Reply Context */}
      {replyingTo && (
        <View style={styles.replyContext}>
          <View style={styles.replyContextContent}>
            <Text style={styles.replyContextLabel}>Replying to {replyingTo.senderName}</Text>
            <Text style={styles.replyContextMessage} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={cancelReply} style={styles.cancelReplyButton}>
            <Text style={styles.cancelReplyText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={[
              styles.attachButton,
              (!canSendMessages || uploading) && styles.attachButtonDisabled,
            ]}
            onPress={() => setShowAttachmentMenu(true)}
            disabled={uploading || !canSendMessages}
          >
            <Text style={styles.attachButtonText}>+</Text>
          </TouchableOpacity>
          
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder={
            replyingTo
              ? 'Type your reply...'
              : chatDisabledMessage ?? 'Type a message...'
          }
          multiline
            maxLength={1000}
          editable={canSendMessages}
        />
          
        <TouchableOpacity 
            style={[
              styles.sendButton,
              (!newMessage.trim() && !uploading) || !canSendMessages
                ? styles.sendButtonDisabled
                : null,
            ]}
            onPress={replyingTo ? sendReply : () => sendMessage()}
            disabled={!newMessage.trim() || uploading || !canSendMessages}
        >
            <Text style={styles.sendButtonText}>
              {uploading ? '⏳' : 'Send'}
            </Text>
        </TouchableOpacity>
      </View>
      
      {/* File Attachment Modal */}
      {showFileAttachment && (
        <FileAttachment
          onFileUpload={handleFileUpload}
          onClose={() => setShowFileAttachment(false)}
          uploading={uploading}
          setUploading={setUploading}
        />
      )}
      
      {/* Voice Message Modal */}
      {showVoiceMessage && (
        <VoiceMessage
          onSend={handleVoiceMessageUpload}
          onCancel={() => setShowVoiceMessage(false)}
          isVisible={showVoiceMessage}
        />
      )}

      {/* Attachment Menu Modal */}
      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onCamera={showImagePicker}
        onDocument={() => setShowFileAttachment(true)}
        onVoice={() => setShowVoiceMessage(true)}
      />


      {/* Reaction Picker Modal */}
      {showReactionPicker && (
        <MessageReactions
          messageId={showReactionPicker}
          currentUserId={user?.id || ''}
          onReactionChange={() => setShowReactionPicker(null)}
          showPicker={true}
        />
      )}

      {/* Image Viewer Modal */}
      <ImageViewer
        visible={showImageViewer && !!selectedImageUrl}
        images={selectedImageUrl ? [selectedImageUrl] : []}
        initialIndex={0}
        onClose={() => setShowImageViewer(false)}
      />

      {/* File Viewer Modal */}
      {selectedFile && (
        <FileViewer
          visible={showFileViewer}
          fileUrl={selectedFile.url}
          fileName={selectedFile.name}
          fileType={selectedFile.type}
          fileSize={selectedFile.size}
          onClose={() => {
            setShowFileViewer(false);
            setSelectedFile(null);
          }}
        />
      )}



      {/* Offer Templates Modal */}
      <OfferTemplates
        visible={showOfferTemplates}
        onTemplateSelect={(template: { content: string }) => {
          setNewMessage(template.content);
          setShowOfferTemplates(false);
        }}
        onClose={() => setShowOfferTemplates(false)}
      />

      {/* Bulk Offers Modal */}
      <BulkOffers
        visible={showBulkOffers}
        currentUserId={user?.id || ''}
        otherUserId={otherUserId}
        onClose={() => setShowBulkOffers(false)}
        onOffersSent={() => {
          // Refresh messages or show success message
        }}
      />

      {/* Counter Offers Modal */}
      <CounterOffers
        visible={!!showCounterOffers}
        messageId={showCounterOffers}
        currentUserId={user?.id || ''}
        onClose={() => setShowCounterOffers(null)}
        onOfferResponse={() => {
          // Refresh messages or show success message
        }}
      />
      <Modal
        visible={showSafetyMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSafetyMenu(false)}
      >
        <TouchableOpacity
          style={styles.safetyMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowSafetyMenu(false)}
        >
          <View style={styles.safetyMenuContainer}>
            <Text style={styles.safetyMenuTitle}>Safety & support</Text>
            <TouchableOpacity
              style={[
                styles.safetyMenuOption,
                styles.safetyMenuOptionAccent,
              ]}
              onPress={() => {
                setShowSafetyMenu(false);
                handleReportUserFromChat();
              }}
            >
              <Text style={styles.safetyMenuOptionIcon}>⚑</Text>
              <View style={styles.safetyMenuOptionTextWrap}>
                <Text
                  style={[
                    styles.safetyMenuOptionText,
                    styles.safetyMenuOptionTextAccent,
                  ]}
                >
                  Report user
                </Text>
                <Text
                  style={[
                    styles.safetyMenuOptionHelper,
                    styles.safetyMenuOptionHelperAccent,
                  ]}
                >
                  Flag {otherUser?.username || 'this user'} for moderator review
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.safetyMenuOption,
                blockedByMe ? styles.safetyMenuOptionSuccess : styles.safetyMenuOptionDanger,
              ]}
              disabled={blockActionLoading}
              onPress={() => {
                setShowSafetyMenu(false);
                blockedByMe ? handleUnblockConversation() : handleBlockConversation();
              }}
            >
              <Text style={styles.safetyMenuOptionIcon}>
                {blockedByMe ? '✅' : '🚫'}
              </Text>
              <View style={styles.safetyMenuOptionTextWrap}>
                <Text
                  style={[
                    styles.safetyMenuOptionText,
                    blockedByMe ? styles.safetyMenuOptionTextSuccess : styles.safetyMenuOptionTextDanger,
                  ]}
                >
                  {blockedByMe ? 'Unblock user' : 'Block user'}
                </Text>
                <Text
                  style={[
                    styles.safetyMenuOptionHelper,
                    blockedByMe
                      ? styles.safetyMenuOptionHelperSuccess
                      : styles.safetyMenuOptionHelperDanger,
                  ]}
                >
                  {blockedByMe
                    ? 'Allow messages from this user again'
                    : 'Stop all messages and remove pending offers'}
                </Text>
              </View>
            </TouchableOpacity>
            {blockedByOther && !blockedByMe && (
              <View style={styles.safetyMenuInfo}>
                <Text style={styles.safetyMenuInfoText}>
                  You cannot unblock users who have blocked you.
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
      <MessageContextMenu
        visible={showContextMenu}
        onClose={() => {
          setShowContextMenu(false);
          setContextMenuMessage(null);
        }}
        onReact={() => {
          if (contextMenuMessage) {
            setShowReactionPicker(contextMenuMessage.id);
          }
        }}
        onReply={() => {
          if (contextMenuMessage) {
            const senderName =
              contextMenuMessage.sender_id === user?.id
                ? 'You'
                : otherUser?.username || 'Unknown';
            handleReply(
              contextMenuMessage.id,
              contextMenuMessage.content || '',
              senderName,
            );
          }
        }}
        onReport={
          contextMenuMessage ? () => handleReportMessage(contextMenuMessage) : undefined
        }
        messageId={contextMenuMessage?.id || ''}
      />
      <ReportContentSheet
        visible={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 70,
  },
  backButtonContainer: {
    padding: 8,
    marginLeft: -8,
  },
  backButton: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: '600',
  },
  headerUserContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    fontSize: 16,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  safetyButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
  },
  safetyButtonText: {
    fontSize: 18,
    color: '#312E81',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  messagesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    flexGrow: 1,
  },
  messageWrapper: {
    marginBottom: 20,
    maxWidth: '85%',
  },
  ownMessageWrapper: {
    marginBottom: 20,
    maxWidth: '85%',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
  },
  otherMessageWrapper: {
    marginBottom: 20,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  messageContainer: {
    // Remove marginBottom as it's now on wrapper
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  offerMessage: {
    maxWidth: '90%',
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  messageImageContainer: {
    marginBottom: 6,
  },
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#1E293B',
  },
  messageTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  ownMessageTime: {
    textAlign: 'right',
  },
  otherMessageTime: {
    textAlign: 'left',
  },
  offerMessageText: {
    color: '#92400E',
    fontWeight: '600',
  },
  offerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  offerButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  declineButton: {
    backgroundColor: '#EF4444',
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  blockNotice: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  blockNoticeText: {
    flex: 1,
    color: '#9F1239',
    fontWeight: '600',
  },
  blockNoticeAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#9F1239',
  },
  blockNoticeActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  attachButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButtonDisabled: {
    opacity: 0.4,
  },
  attachButtonText: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  replyContext: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  replyContextContent: {
    flex: 1,
  },
  replyContextLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 2,
  },
  replyContextMessage: {
    fontSize: 14,
    color: '#64748B',
  },
  cancelReplyButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  cancelReplyText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  safetyMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  safetyMenuContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  safetyMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  safetyMenuOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
  },
  safetyMenuOptionAccent: {
    backgroundColor: '#F5F3FF',
  },
  safetyMenuOptionDanger: {
    backgroundColor: '#FEF2F2',
  },
  safetyMenuOptionSuccess: {
    backgroundColor: '#ECFDF5',
  },
  safetyMenuOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  safetyMenuOptionTextWrap: {
    flex: 1,
  },
  safetyMenuOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  safetyMenuOptionTextAccent: {
    color: '#312E81',
  },
  safetyMenuOptionHelper: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  safetyMenuOptionHelperAccent: {
    color: '#4C1D95',
  },
  safetyMenuOptionTextDanger: {
    color: '#B91C1C',
  },
  safetyMenuOptionTextSuccess: {
    color: '#047857',
  },
  safetyMenuOptionHelperDanger: {
    color: '#9F1239',
  },
  safetyMenuOptionHelperSuccess: {
    color: '#047857',
  },
  safetyMenuInfo: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  safetyMenuInfoText: {
    fontSize: 12,
    color: '#475569',
  },
});
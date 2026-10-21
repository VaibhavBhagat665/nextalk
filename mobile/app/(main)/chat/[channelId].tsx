/**
 * Enhanced Chat Screen with FlashList
 * 
 * Features:
 * - @shopify/flash-list for optimized message rendering
 * - Cursor-based pagination for infinite scroll
 * - Swipe-to-reply gesture functionality
 * - Real-time Socket.io updates
 * - Loading states and empty states
 * - Offline message queue with exponential backoff
 * - Message status indicators (sending/sent/failed)
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions,
  Image as RNImage, Alert, ScrollView, RefreshControl
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { fetchApi } from '../../../lib/api';
import { socketService } from '../../../lib/socket';
import { useAppStore } from '../../../lib/store';
import { Avatar } from '../../../components/ui/Avatar';
import { AICopilotBottomSheet } from '../../../components/modals/AICopilotBottomSheet';
import { MessageStatusIndicator } from '../../../components/ui/MessageStatusIndicator';
import { radius, spacing } from '../../../lib/theme';
import { Send, Paperclip, Sparkles, X, Smile, Reply, Loader2, Camera, Image as ImageIcon } from 'lucide-react-native';
import {
  showImageSourcePicker,
  uploadImageToCloudinary,
  type OptimizedImageResult,
} from '../../../lib/image-upload';
import { useMessageQueue } from '../../../hooks/useMessageQueue';
import { messageQueueService, type QueuedMessage } from '../../../lib/message-queue';

type Message = {
  id: string;
  content: string;
  userId: string;
  username: string;
  imageUrl?: string;
  createdAt: string;
  fileUrl?: string;
  fileType?: string;
  user?: {
    id: string;
    username: string;
    imageUrl?: string;
  };
};

const { width: screenWidth } = Dimensions.get('window');
const MAX_BUBBLE = screenWidth * 0.78;
const SWIPE_THRESHOLD = 50; // Pixels to trigger reply

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '💯', '✨', '🙌', '👀', '🚀'];

export default function ChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const colors = useAppStore((s) => s.colors);

  // Message queue hook for offline support
  const { queuedMessages, enqueueMessage, retryMessage, deleteMessage } = useMessageQueue(channelId || '');

  // Message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  
  // Real-time state
  const [typing, setTyping] = useState<string[]>([]);
  
  // UI state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<OptimizedImageResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showCopilot, setShowCopilot] = useState(false);

  const flashListRef = useRef<FlashList<Message>>(null);
  const copilotRef = useRef<BottomSheet>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  // Load initial messages
  const loadMessages = useCallback(async (cursor?: string, isRefresh = false) => {
    if (!channelId || !user) return;
    
    try {
      if (!cursor && !isRefresh) setLoading(true);
      if (cursor) setLoadingMore(true);
      if (isRefresh) setRefreshing(true);

      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({
        channelId,
        limit: '50',
      });
      
      if (cursor) {
        params.append('cursor', cursor);
      }

      const data = await fetchApi(`/api/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (isRefresh) {
        // Pull to refresh - replace messages
        setMessages(data.messages || []);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else if (cursor) {
        // Load more - append older messages
        setMessages((prev) => [...(data.messages || []), ...prev]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else {
        // Initial load
        setMessages(data.messages || []);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
        initialLoadDone.current = true;
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [channelId, user, getToken]);

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    loadMessages(nextCursor);
  }, [loadingMore, hasMore, nextCursor, loadMessages]);

  // Refresh messages
  const handleRefresh = useCallback(() => {
    loadMessages(undefined, true);
  }, [loadMessages]);

  // Socket.io setup
  useEffect(() => {
    if (!channelId || !user) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // Connect socket
        socketService.connect(user.id, user.username || 'User', user.imageUrl, token);
        const socket = socketService.getSocket();
        
        if (socket) {
          // Join channel
          socket.emit('channel:join', channelId);

          // Listen for new messages
          socket.on('message:new', (msg: Message) => {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            
            // Scroll to bottom if near bottom
            setTimeout(() => {
              if (flashListRef.current) {
                flashListRef.current.scrollToEnd({ animated: true });
              }
            }, 100);
          });

          // Listen for typing indicators
          socket.on('typing:update', (data: { username: string; isTyping: boolean }) => {
            setTyping((prev) =>
              data.isTyping 
                ? [...new Set([...prev, data.username])] 
                : prev.filter((u) => u !== data.username)
            );
          });
        }

        // Load initial messages
        await loadMessages();
      } catch (err) {
        console.error('Socket setup error:', err);
      }
    })();

    // Cleanup
    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('channel:leave', channelId);
        socket.off('message:new');
        socket.off('typing:update');
      }
    };
  }, [channelId, user, getToken, loadMessages]);

  // Emit typing indicator
  const emitTyping = useCallback(() => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('typing:start', channelId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', channelId);
      }, 2000);
    }
  }, [channelId]);

  // Pick image with source selection
  const handleImagePick = async () => {
    Haptics.selectionAsync();
    
    showImageSourcePicker((image) => {
      setSelectedImage(image);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  // Alias for backward compatibility
  const pickImage = handleImagePick;

  // Open AI Copilot
  const handleOpenCopilot = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCopilot(true);
    copilotRef.current?.snapToIndex(0);
  };

  // Close AI Copilot
  const handleCloseCopilot = () => {
    setShowCopilot(false);
  };

  // Send message
  const sendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || !channelId || !user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    let fileUrl = null;
    let fileType = null;
    
    // Upload image if selected
    if (selectedImage) {
      setUploading(true);
      setUploadProgress(0);
      
      try {
        const token = await getToken();
        if (!token) {
          throw new Error('No auth token');
        }
        
        fileUrl = await uploadImageToCloudinary(
          selectedImage.uri,
          token,
          (progress) => setUploadProgress(progress)
        );
        fileType = 'image/jpeg';
      } catch (err) {
        console.error('Upload error:', err);
        Alert.alert('Upload failed', 'Could not upload image. Please try again.');
        setUploading(false);
        setUploadProgress(0);
        return;
      }
    }

    // Enqueue message for offline support
    const queuedMsg = await messageQueueService.enqueue({
      channelId,
      content: inputText.trim(),
      fileUrl: fileUrl || undefined,
      fileType: fileType || undefined,
      userId: user.id,
      username: user.username || 'Unknown',
      imageUrl: user.imageUrl || '',
    });

    // Clear input immediately for better UX
    setInputText('');
    setSelectedImage(null);
    setReplyingTo(null);
    setUploading(false);
    setUploadProgress(0);

    // Stop typing indicator
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('typing:stop', channelId);
    }
  };

  // Merge server messages with queued messages
  const allMessages = React.useMemo(() => {
    // Convert queued messages to Message format
    const queuedAsMessages: (Message & { queuedMessage?: QueuedMessage })[] = queuedMessages.map(qm => ({
      id: qm.id,
      content: qm.content,
      userId: qm.userId,
      username: qm.username,
      imageUrl: qm.imageUrl,
      createdAt: new Date(qm.timestamp).toISOString(),
      fileUrl: qm.fileUrl,
      fileType: qm.fileType,
      queuedMessage: qm,
    }));

    // Merge and sort by timestamp
    const merged = [...messages, ...queuedAsMessages];
    merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    return merged;
  }, [messages, queuedMessages]);

  // Render message with swipe gesture
  const renderMessage = useCallback(({ item, index }: { item: Message & { queuedMessage?: QueuedMessage }; index: number }) => {
    const isMe = item.userId === user?.id;
    const prevMsg = index > 0 ? allMessages[index - 1] : null;
    const showAvatar = !isMe && (!prevMsg || prevMsg.userId !== item.userId);
    const isConsecutive = prevMsg && prevMsg.userId === item.userId;

    return (
      <SwipeableMessage
        message={item}
        isMe={isMe}
        showAvatar={showAvatar}
        isConsecutive={isConsecutive}
        colors={colors}
        queuedMessage={item.queuedMessage}
        onReply={() => {
          setReplyingTo(item);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        onRetry={item.queuedMessage ? () => retryMessage(item.id) : undefined}
      />
    );
  }, [allMessages, user, colors, retryMessage]);

  // Empty state
  const renderEmpty = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
          No messages yet. Start the conversation! 💬
        </Text>
      </View>
    );
  };

  // Loading footer (for pagination)
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.accentGold} />
        <Text style={[styles.loadingText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
          Loading more messages...
        </Text>
      </View>
    );
  };

  if (loading && !initialLoadDone.current) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accentGold} />
        <Text style={[styles.loadingText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular', marginTop: 12 }]}>
          Loading messages...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 0}
    >
      {/* Messages List */}
      <FlashList
        ref={flashListRef}
        data={allMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        estimatedItemSize={80}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreMessages}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={renderFooter}
        inverted={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accentGold}
            colors={[colors.accentGold]}
          />
        }
      />

      {/* Typing Indicator */}
      {typing.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.typingBar, { borderTopColor: colors.borderSecondary }]}
        >
          <View style={styles.typingDots}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[styles.typingDot, { backgroundColor: colors.accentGold }]}
              />
            ))}
          </View>
          <Text style={[styles.typingText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
            {typing.join(', ')} {typing.length === 1 ? 'is' : 'are'} typing...
          </Text>
        </Animated.View>
      )}

      {/* Reply Preview */}
      {replyingTo && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={[styles.replyPreview, { backgroundColor: colors.bgSecondary, borderTopColor: colors.borderPrimary }]}
        >
          <View style={styles.replyContent}>
            <Reply size={16} color={colors.accentGold} />
            <View style={styles.replyTextContainer}>
              <Text style={[styles.replyUsername, { color: colors.accentGold, fontFamily: 'Fredoka-Medium' }]}>
                {replyingTo.username || replyingTo.user?.username}
              </Text>
              <Text style={[styles.replyText, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]} numberOfLines={1}>
                {replyingTo.content || '📷 Image'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyClose}>
            <X size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Selected Image Preview */}
      {selectedImage && (
        <View style={[styles.previewContainer, { backgroundColor: colors.bgSecondary, borderTopColor: colors.borderPrimary }]}>
          <View style={styles.previewWrap}>
            <RNImage source={{ uri: selectedImage.uri }} style={styles.previewImage} />
            <TouchableOpacity style={styles.previewClose} onPress={() => setSelectedImage(null)}>
              <X size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          {uploading && (
            <View style={styles.uploadProgressContainer}>
              <ActivityIndicator size="small" color={colors.accentGold} />
              <Text style={[styles.uploadProgressText, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                Uploading... {uploadProgress}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={[styles.emojiRow, { backgroundColor: colors.bgSecondary }]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {COMMON_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => {
                  Haptics.selectionAsync();
                  setInputText(prev => prev + emoji);
                }}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.bgSecondary, borderTopColor: colors.borderPrimary }]}>
        <TouchableOpacity style={styles.inputIcon} onPress={pickImage} activeOpacity={0.6}>
          <Paperclip size={20} color={colors.textTertiary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.inputIcon}
          onPress={() => setShowEmojiPicker(!showEmojiPicker)}
          activeOpacity={0.6}
        >
          <Smile size={20} color={showEmojiPicker ? colors.accentGold : colors.textTertiary} />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBg, color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={(text) => {
            setInputText(text);
            emitTyping();
          }}
          multiline
          maxLength={2000}
        />

        <TouchableOpacity
          style={styles.inputIcon}
          onPress={handleOpenCopilot}
          activeOpacity={0.6}
        >
          <Sparkles size={20} color={colors.accentGold} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={sendMessage}
          disabled={(!inputText.trim() && !selectedImage) || uploading}
          activeOpacity={0.7}
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            opacity: (inputText.trim() || selectedImage) && !uploading ? 1 : 0.4
          }}
        >
          <LinearGradient
            colors={[colors.accentGold, colors.accentBrass]}
            style={styles.sendBtn}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#F2EDE7" />
            ) : (
              <Send size={18} color="#F2EDE7" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* AI Copilot Bottom Sheet */}
      {showCopilot && (
        <AICopilotBottomSheet
          ref={copilotRef}
          channelId={channelId}
          onClose={handleCloseCopilot}
        />
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * Swipeable Message Component
 * Implements swipe-to-reply gesture
 */
interface SwipeableMessageProps {
  message: Message;
  isMe: boolean;
  showAvatar: boolean;
  isConsecutive: boolean;
  colors: any;
  queuedMessage?: QueuedMessage;
  onReply: () => void;
  onRetry?: () => void;
}

function SwipeableMessage({ message, isMe, showAvatar, isConsecutive, colors, queuedMessage, onReply, onRetry }: SwipeableMessageProps) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX(isMe ? [-10, 10] : [10, -10])
    .onUpdate((event) => {
      // Swipe right for other user's messages, left for my messages
      const translation = isMe ? Math.min(0, event.translationX) : Math.max(0, event.translationX);
      translateX.value = translation;
      
      // Show reply icon as user swipes
      opacity.value = Math.min(1, Math.abs(translation) / SWIPE_THRESHOLD);
    })
    .onEnd((event) => {
      const translation = isMe ? event.translationX : event.translationX;
      
      if (Math.abs(translation) > SWIPE_THRESHOLD) {
        // Trigger reply
        onReply();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Reset
      translateX.value = withSpring(0);
      opacity.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.swipeContainer}>
      {/* Reply Icon (appears during swipe) */}
      {!isMe && (
        <Animated.View style={[styles.replyIcon, styles.replyIconLeft, iconAnimatedStyle]}>
          <Reply size={20} color={colors.accentGold} />
        </Animated.View>
      )}
      
      {/* Message Bubble */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.messageContainer, animatedStyle]}>
          <View style={[styles.msgRow, isMe && styles.msgRowMe, isConsecutive && { marginTop: 2 }]}>
            {!isMe && (
              <View style={styles.avatarCol}>
                {showAvatar ? (
                  <Avatar src={message.imageUrl || message.user?.imageUrl} fallback={message.username || message.user?.username} size={34} />
                ) : (
                  <View style={{ width: 34 }} />
                )}
              </View>
            )}

            <View style={[styles.bubbleOuter, { maxWidth: MAX_BUBBLE }]}>
              {!isMe && showAvatar && (
                <Text style={[styles.username, { color: colors.accentGold, fontFamily: 'Fredoka-Medium' }]}>
                  {message.username || message.user?.username}
                </Text>
              )}
              
              <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {message.fileUrl && message.fileType?.includes('image') && (
                  <RNImage source={{ uri: message.fileUrl }} style={styles.messageImage} />
                )}
                
                {message.content ? (
                  isMe ? (
                    <View>
                      <LinearGradient
                        colors={[colors.accentGold, colors.accentBrass]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.bubble, styles.bubbleMe]}
                      >
                        <Text style={[styles.msgText, { color: '#F2EDE7', fontFamily: 'ComicNeue-Regular' }]}>
                          {message.content}
                        </Text>
                      </LinearGradient>
                      {/* Message Status Indicator */}
                      {queuedMessage && (
                        <View style={styles.statusContainer}>
                          <MessageStatusIndicator
                            status={queuedMessage.status}
                            onRetry={queuedMessage.status === 'failed' ? onRetry : undefined}
                            color="rgba(242, 237, 231, 0.7)"
                            size={14}
                          />
                          {queuedMessage.status === 'failed' && queuedMessage.error && (
                            <Text style={styles.errorText}>{queuedMessage.error}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.bubble,
                        styles.bubbleOther,
                        { backgroundColor: colors.bgSecondary, borderColor: colors.borderPrimary }
                      ]}
                    >
                      <Text style={[styles.msgText, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}>
                        {message.content}
                      </Text>
                    </View>
                  )
                ) : null}
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Reply Icon (appears during swipe - right side for my messages) */}
      {isMe && (
        <Animated.View style={[styles.replyIcon, styles.replyIconRight, iconAnimatedStyle]}>
          <Reply size={20} color={colors.accentGold} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 8 },
  
  // Message styles
  swipeContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  messageContainer: {
    width: '100%',
  },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  msgRowMe: { justifyContent: 'flex-end' },
  avatarCol: { marginRight: 8, marginBottom: 2 },
  bubbleOuter: {},
  username: { fontSize: 12, marginBottom: 3, marginLeft: 4 },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1 },
  msgText: { fontSize: 16, lineHeight: 22 },
  messageImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  
  // Message status
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    fontFamily: 'ComicNeue-Regular',
  },
  
  // Reply icon (swipe gesture)
  replyIcon: {
    position: 'absolute',
    top: '50%',
    marginTop: -10,
    zIndex: 1,
  },
  replyIconLeft: { left: 8 },
  replyIconRight: { right: 8 },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 16, textAlign: 'center' },
  
  // Loading states
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: { fontSize: 14 },
  
  // Typing indicator
  typingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderTopWidth: 1,
    gap: 8,
  },
  typingDots: { flexDirection: 'row', gap: 3 },
  typingDot: { width: 5, height: 5, borderRadius: 3 },
  typingText: { fontSize: 13 },
  
  // Reply preview
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  replyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  replyTextContainer: { flex: 1 },
  replyUsername: { fontSize: 12, marginBottom: 2 },
  replyText: { fontSize: 14 },
  replyClose: { padding: 4 },
  
  // Image preview
  previewContainer: { padding: 12, borderTopWidth: 1 },
  previewWrap: { width: 80, height: 80, borderRadius: 12, position: 'relative' },
  previewImage: { width: '100%', height: '100%', borderRadius: 12 },
  previewClose: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  uploadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  uploadProgressText: {
    fontSize: 13,
  },
  
  // Emoji picker
  emojiRow: { paddingVertical: 12 },
  emojiText: { fontSize: 24 },
  
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    borderTopWidth: 1,
    gap: 4,
  },
  inputIcon: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 16,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

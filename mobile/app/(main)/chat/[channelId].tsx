import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions,
  Image as RNImage, Alert, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { fetchApi } from '../../../lib/api';
import { socketService } from '../../../lib/socket';
import { useAppStore } from '../../../lib/store';
import { Avatar } from '../../../components/ui/Avatar';
import { radius, spacing } from '../../../lib/theme';
import { Send, Paperclip, Sparkles, Image as ImageIcon, X, FileText, Smile } from 'lucide-react-native';

type Message = {
  id: string;
  content: string;
  userId: string;
  username: string;
  imageUrl?: string;
  createdAt: string;
  fileUrl?: string;
  fileType?: string;
};

const { width: screenWidth } = Dimensions.get('window');
const MAX_BUBBLE = screenWidth * 0.78;

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '💯', '✨', '🙌', '👀', '🚀'];

export default function ChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const colors = useAppStore((s) => s.colors);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!channelId || !user) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        socketService.connect(user.id, user.username || 'User', user.imageUrl, token);
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('channel:join', channelId);
          socket.on('message:new', (msg: Message) => {
            setMessages((prev) => [...prev, msg]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
          });
          socket.on('typing:update', (data: { username: string; isTyping: boolean }) => {
            setTyping((prev) =>
              data.isTyping ? [...new Set([...prev, data.username])] : prev.filter((u) => u !== data.username)
            );
          });
        }
        const data = await fetchApi(`/api/messages?channelId=${channelId}`, { headers: { Authorization: `Bearer ${token}` } });
        setMessages(data.messages || []);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    })();
    return () => {
      const socket = socketService.getSocket();
      if (socket) { socket.emit('channel:leave', channelId); socket.off('message:new'); socket.off('typing:update'); }
    };
  }, [channelId, user]);

  const emitTyping = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('typing:start', channelId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => { socket.emit('typing:stop', channelId); }, 2000);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      Haptics.selectionAsync();
      setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const sendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || !channelId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    let fileUrl = null;
    let fileType = null;
    
    if (selectedImage) {
      setUploading(true);
      try {
        const token = await getToken();
        // Assuming your backend expects a POST to /api/upload with file payload
        // If the web handles base64, we send it like this:
        const uploadRes = await fetchApi('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: selectedImage }),
        });
        fileUrl = uploadRes.url;
        fileType = 'image/jpeg';
      } catch (err) {
        Alert.alert('Upload failed', 'Could not upload image.');
        setUploading(false);
        return;
      }
    }

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('message:send', {
        channelId,
        content: inputText.trim(),
        tempId: Date.now().toString(),
        fileUrl,
        fileType,
      });
      socket.emit('typing:stop', channelId);
      setInputText('');
      setSelectedImage(null);
      setUploading(false);
    }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accentGold} /></View>;

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.userId === user?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.userId !== item.userId);
    const isConsecutive = index > 0 && messages[index - 1]?.userId === item.userId;

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe, isConsecutive && { marginTop: 2 }]}>
        {!isMe && <View style={styles.avatarCol}>{showAvatar ? <Avatar src={item.imageUrl} fallback={item.username} size={34} /> : <View style={{ width: 34 }} />}</View>}

        <View style={[styles.bubbleOuter, { maxWidth: MAX_BUBBLE }]}>
          {!isMe && showAvatar && <Text style={[styles.username, { color: colors.accentGold, fontFamily: 'Fredoka-Medium' }]}>{item.username}</Text>}
          
          <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
            {item.fileUrl && item.fileType?.includes('image') && (
              <RNImage source={{ uri: item.fileUrl }} style={styles.messageImage} />
            )}
            
            {item.content ? (
              isMe ? (
                <LinearGradient colors={[colors.accentGold, colors.accentBrass]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMe]}>
                  <Text style={[styles.msgText, { color: '#F2EDE7', fontFamily: 'ComicNeue-Regular' }]}>{item.content}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.bubble, styles.bubbleOther, { backgroundColor: colors.bgSecondary, borderColor: colors.borderPrimary }]}>
                  <Text style={[styles.msgText, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}>{item.content}</Text>
                </View>
              )
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bgPrimary }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 0}>
      <FlatList ref={flatListRef} data={messages} keyExtractor={(item) => item.id} renderItem={renderMessage} contentContainerStyle={styles.listContent} onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })} showsVerticalScrollIndicator={false} />

      {typing.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.typingBar, { borderTopColor: colors.borderSecondary }]}>
          <View style={styles.typingDots}>{[0, 1, 2].map((i) => <Animated.View key={i} style={[styles.typingDot, { backgroundColor: colors.accentGold }]} />)}</View>
          <Text style={[styles.typingText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>{typing.join(', ')} {typing.length === 1 ? 'is' : 'are'} typing...</Text>
        </Animated.View>
      )}

      {/* Selected Image Preview */}
      {selectedImage && (
        <View style={[styles.previewContainer, { backgroundColor: colors.bgSecondary, borderTopColor: colors.borderPrimary }]}>
          <View style={styles.previewWrap}>
            <RNImage source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity style={styles.previewClose} onPress={() => setSelectedImage(null)}>
              <X size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Emoji Picker Row */}
      {showEmojiPicker && (
        <Animated.View entering={FadeInUp.duration(200)} style={[styles.emojiRow, { backgroundColor: colors.bgSecondary }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {COMMON_EMOJIS.map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => { Haptics.selectionAsync(); setInputText(prev => prev + emoji); }}>
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
        
        <TouchableOpacity style={styles.inputIcon} onPress={() => setShowEmojiPicker(!showEmojiPicker)} activeOpacity={0.6}>
          <Smile size={20} color={showEmojiPicker ? colors.accentGold : colors.textTertiary} />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={(text) => { setInputText(text); emitTyping(); }}
          multiline maxLength={2000}
        />

        <TouchableOpacity style={styles.inputIcon} onPress={() => router.push(`/(main)/info/${channelId}`)} activeOpacity={0.6}>
          <Sparkles size={20} color={colors.accentGold} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={sendMessage}
          disabled={(!inputText.trim() && !selectedImage) || uploading}
          activeOpacity={0.7}
          style={{ borderRadius: 20, overflow: 'hidden', opacity: (inputText.trim() || selectedImage) && !uploading ? 1 : 0.4 }}
        >
          <LinearGradient colors={[colors.accentGold, colors.accentBrass]} style={styles.sendBtn}>
            {uploading ? <ActivityIndicator size="small" color="#F2EDE7" /> : <Send size={18} color="#F2EDE7" />}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, listContent: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end' }, msgRowMe: { justifyContent: 'flex-end' },
  avatarCol: { marginRight: 8, marginBottom: 2 }, bubbleOuter: {}, username: { fontSize: 12, marginBottom: 3, marginLeft: 4 },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 }, bubbleMe: { borderBottomRightRadius: 4 }, bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1 },
  msgText: { fontSize: 16, lineHeight: 22 },
  messageImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  typingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 6, borderTopWidth: 1, gap: 8 },
  typingDots: { flexDirection: 'row', gap: 3 }, typingDot: { width: 5, height: 5, borderRadius: 3 }, typingText: { fontSize: 13 },
  previewContainer: { padding: 12, borderTopWidth: 1 },
  previewWrap: { width: 80, height: 80, borderRadius: 12, position: 'relative' },
  previewImage: { width: '100%', height: '100%', borderRadius: 12 },
  previewClose: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },
  emojiRow: { paddingVertical: 12 }, emojiText: { fontSize: 24 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 10, borderTopWidth: 1, gap: 4 },
  inputIcon: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
});

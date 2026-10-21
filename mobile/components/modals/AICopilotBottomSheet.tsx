/**
 * AI Copilot Bottom Sheet Component
 * 
 * Task 60.1: Create Copilot bottom sheet
 * Requirements: 7.5 - Mobile app should have AI Copilot feature parity with web
 * Validates: Property 30 - Mobile AI Parity
 * 
 * Provides AI-powered query capabilities using RAG semantic search
 * connected to the /api/ai/query endpoint.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useAuth } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { Sparkles, Send, X, BookOpen, AlertCircle } from 'lucide-react-native';
import { useAppStore } from '../../lib/store';
import { Button } from '../ui/Button';
import { fetchApi } from '../../lib/api';

interface AICopilotBottomSheetProps {
  channelId: string | null;
  onClose: () => void;
}

interface AIResponse {
  answer: string;
  context: string;
  sources: number;
  timestamp: string;
  cached?: boolean;
}

export const AICopilotBottomSheet = React.forwardRef<BottomSheet, AICopilotBottomSheetProps>(
  ({ channelId, onClose }, ref) => {
    const { getToken } = useAuth();
    const colors = useAppStore((s) => s.colors);

    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<AIResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const inputRef = useRef<TextInput>(null);

    // Snap points for the bottom sheet
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    // Backdrop component
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.6}
          pressBehavior="close"
        />
      ),
      []
    );

    // Handle query submission
    const handleSubmitQuery = async () => {
      if (!query.trim() || !channelId || loading) return;

      Keyboard.dismiss();
      setLoading(true);
      setError(null);
      setResponse(null);

      try {
        const token = await getToken();
        const result = await fetchApi('/api/ai/query', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query.trim(),
            channelId,
            topK: 5,
          }),
        });

        setResponse(result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: any) {
        console.error('AI query failed:', err);
        setError(err.message || 'Failed to get AI response');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setLoading(false);
      }
    };

    // Handle sheet close
    const handleClose = () => {
      setQuery('');
      setResponse(null);
      setError(null);
      onClose();
    };

    // Handle new query
    const handleNewQuery = () => {
      setQuery('');
      setResponse(null);
      setError(null);
      inputRef.current?.focus();
    };

    return (
      <BottomSheet
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={handleClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.bgSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.borderPrimary }}
      >
        <BottomSheetView style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderPrimary }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.accentPurple}15` }]}>
                <Sparkles size={20} color={colors.accentPurple} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>AI Copilot</Text>
                <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                  Ask about chat history
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Query Input Section */}
            <View style={styles.inputSection}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>YOUR QUESTION</Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary },
                ]}
              >
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="What was discussed about the project timeline?"
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  multiline
                  maxLength={500}
                  editable={!loading}
                  autoFocus
                />
              </View>
              <Button
                title={loading ? 'Thinking...' : 'Ask Copilot'}
                icon={loading ? undefined : <Send size={16} color="#F2EDE7" />}
                isLoading={loading}
                disabled={!query.trim() || !channelId}
                onPress={handleSubmitQuery}
                fullWidth
                size="lg"
                variant="gold"
                style={styles.submitBtn}
              />
            </View>

            {/* Error Display */}
            {error && (
              <View
                style={[
                  styles.errorCard,
                  {
                    backgroundColor: `${colors.accentRose}12`,
                    borderColor: `${colors.accentRose}25`,
                  },
                ]}
              >
                <AlertCircle size={18} color={colors.accentRose} />
                <Text style={[styles.errorText, { color: colors.accentRose }]}>{error}</Text>
              </View>
            )}

            {/* Response Display */}
            {response && (
              <View style={styles.responseSection}>
                {/* Answer Card */}
                <View
                  style={[
                    styles.answerCard,
                    {
                      backgroundColor: colors.bgTertiary,
                      borderColor: colors.borderPrimary,
                    },
                  ]}
                >
                  <View style={styles.answerHeader}>
                    <View style={[styles.answerIconWrap, { backgroundColor: `${colors.accentCyan}15` }]}>
                      <Sparkles size={16} color={colors.accentCyan} />
                    </View>
                    <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>
                      AI Response
                    </Text>
                    {response.cached && (
                      <View style={[styles.cachedBadge, { backgroundColor: `${colors.accentGold}15` }]}>
                        <Text style={[styles.cachedText, { color: colors.accentGold }]}>Cached</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.answerText, { color: colors.textPrimary }]}>
                    {response.answer}
                  </Text>
                </View>

                {/* Sources Info */}
                {response.sources > 0 && (
                  <View
                    style={[
                      styles.sourcesCard,
                      {
                        backgroundColor: colors.bgElevated,
                        borderColor: colors.borderPrimary,
                      },
                    ]}
                  >
                    <BookOpen size={14} color={colors.textMuted} />
                    <Text style={[styles.sourcesText, { color: colors.textSecondary }]}>
                      Based on {response.sources} {response.sources === 1 ? 'message' : 'messages'}{' '}
                      from this channel
                    </Text>
                  </View>
                )}

                {/* New Query Button */}
                <Button
                  title="Ask Another Question"
                  variant="outline"
                  onPress={handleNewQuery}
                  fullWidth
                  size="md"
                  style={styles.newQueryBtn}
                />
              </View>
            )}

            {/* Loading State */}
            {loading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={colors.accentPurple} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Searching chat history...
                </Text>
              </View>
            )}

            {/* Empty State */}
            {!loading && !response && !error && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.accentPurple}12` }]}>
                  <Sparkles size={32} color={colors.accentPurple} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  Ask me anything about this channel
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>
                  I can help you find information from past conversations using semantic search
                </Text>
              </View>
            )}
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Fredoka-Bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'ComicNeue-Regular',
  },
  closeBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  inputSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Fredoka-Medium',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 2,
  },
  inputWrapper: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
    minHeight: 100,
  },
  input: {
    fontSize: 16,
    fontFamily: 'ComicNeue-Regular',
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 8,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'ComicNeue-Regular',
    lineHeight: 20,
  },
  responseSection: {
    gap: 12,
  },
  answerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  answerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Fredoka-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cachedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cachedText: {
    fontSize: 11,
    fontFamily: 'Fredoka-SemiBold',
  },
  answerText: {
    fontSize: 16,
    fontFamily: 'ComicNeue-Regular',
    lineHeight: 24,
  },
  sourcesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sourcesText: {
    fontSize: 13,
    fontFamily: 'ComicNeue-Regular',
  },
  newQueryBtn: {
    marginTop: 8,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: 'ComicNeue-Regular',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Fredoka-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: 'ComicNeue-Regular',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});


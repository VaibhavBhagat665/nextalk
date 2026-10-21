/**
 * Message Status Indicator Component
 * 
 * Shows visual indicators for message states:
 * - Sending: Loading spinner
 * - Sent: Checkmark
 * - Failed: Error icon with retry option
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Check, CheckCheck, AlertCircle, RefreshCw } from 'lucide-react-native';
import { MessageStatus } from '../../lib/message-queue';

interface MessageStatusIndicatorProps {
  status: MessageStatus;
  onRetry?: () => void;
  color?: string;
  size?: number;
}

export function MessageStatusIndicator({
  status,
  onRetry,
  color = '#94A3B8',
  size = 14,
}: MessageStatusIndicatorProps) {
  if (status === 'pending' || status === 'sending') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={color} />
      </View>
    );
  }

  if (status === 'sent') {
    return (
      <View style={styles.container}>
        <CheckCheck size={size} color={color} strokeWidth={2} />
      </View>
    );
  }

  if (status === 'failed' && onRetry) {
    return (
      <TouchableOpacity
        onPress={onRetry}
        style={styles.failedContainer}
        activeOpacity={0.7}
      >
        <AlertCircle size={size} color="#EF4444" strokeWidth={2} />
        <RefreshCw size={size - 2} color="#EF4444" strokeWidth={2} style={styles.retryIcon} />
      </TouchableOpacity>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.container}>
        <AlertCircle size={size} color="#EF4444" strokeWidth={2} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 6,
    marginTop: 2,
  },
  failedContainer: {
    marginLeft: 6,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  retryIcon: {
    marginLeft: 2,
  },
});

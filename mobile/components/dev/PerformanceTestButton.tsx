/**
 * Performance Test Button (Development Only)
 * 
 * A floating button that appears in development mode to quickly test
 * scroll performance without modifying test files.
 * 
 * Usage:
 * <PerformanceTestButton flashListRef={flashListRef} />
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { performanceMonitor } from '../../lib/performance-monitor';
import { runScrollPerformanceTest, quickFpsCheck, exportTestResults } from '../../scripts/measure-scroll-performance';
import * as Haptics from 'expo-haptics';
import { Gauge, Zap, FileText, X } from 'lucide-react-native';

interface PerformanceTestButtonProps {
  flashListRef: React.RefObject<FlashList<any>>;
}

export function PerformanceTestButton({ flashListRef }: PerformanceTestButtonProps) {
  const [testing, setTesting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [lastResults, setLastResults] = useState<string | null>(null);

  // Don't render in production
  if (!__DEV__) {
    return null;
  }

  const handleQuickTest = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTesting(true);

    try {
      const fps = await quickFpsCheck(flashListRef);
      
      const passed = fps >= 60;
      const emoji = passed ? '✅' : '❌';
      
      Alert.alert(
        'Quick FPS Check',
        `${emoji} Average FPS: ${fps.toFixed(1)}\n\nTarget: 60 FPS\nStatus: ${passed ? 'PASSED' : 'FAILED'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Quick test error:', error);
      Alert.alert('Error', 'Failed to run quick FPS test');
    } finally {
      setTesting(false);
    }
  };

  const handleFullTest = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTesting(true);

    try {
      const result = await runScrollPerformanceTest(flashListRef, {
        cycles: 5,
        scrollDuration: 1000,
        delayBetweenScrolls: 500,
        randomScroll: false,
      });

      setLastResults(result.summary);
      setShowResults(true);

      const passed = result.passed;
      const emoji = passed ? '✅' : '❌';
      
      Haptics.notificationAsync(
        passed 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Warning
      );
    } catch (error) {
      console.error('Full test error:', error);
      Alert.alert('Error', 'Failed to run full performance test');
    } finally {
      setTesting(false);
    }
  };

  const handleExportResults = () => {
    if (!lastResults) return;

    // In a real app, you would save this to file system or share
    console.log('📊 Test Results:', lastResults);
    Alert.alert(
      'Results Exported',
      'Test results have been logged to console. In production, these would be saved to file.',
      [{ text: 'OK' }]
    );
  };

  return (
    <>
      {/* Floating Test Button */}
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.button, testing && styles.buttonDisabled]}
          onPress={handleQuickTest}
          disabled={testing}
          activeOpacity={0.8}
        >
          {testing ? (
            <ActivityIndicator size="small" color="#1A1A1A" />
          ) : (
            <Zap size={20} color="#1A1A1A" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, testing && styles.buttonDisabled]}
          onPress={handleFullTest}
          disabled={testing}
          activeOpacity={0.8}
        >
          <Gauge size={18} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Results Modal */}
      <Modal
        visible={showResults}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResults(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Performance Test Results</Text>
              <TouchableOpacity
                onPress={() => setShowResults(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#525252" />
              </TouchableOpacity>
            </View>

            {/* Results */}
            <ScrollView style={styles.resultsScroll}>
              <Text style={styles.resultsText}>{lastResults}</Text>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleExportResults}
              >
                <FileText size={18} color="#D4AF37" />
                <Text style={styles.actionButtonText}>Export Results</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => setShowResults(false)}
              >
                <Text style={styles.actionButtonTextPrimary}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonSecondary: {
    backgroundColor: '#E5E5E5',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  resultsScroll: {
    maxHeight: 400,
  },
  resultsText: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: '#404040',
    padding: 20,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  actionButtonPrimary: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#404040',
  },
  actionButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});

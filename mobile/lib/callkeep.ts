/**
 * CallKeep Integration for React Native
 * 
 * Provides native call UI integration for Android and iOS.
 * Shows incoming call notifications and integrates with phone's native call UI.
 */

import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// ============================================================================
// Types
// ============================================================================

export interface CallOptions {
  callUUID: string;
  callerName: string;
  channelId: string;
  channelName: string;
  isVideoCall: boolean;
}

export interface CallKeepEvents {
  onAnswerCall: (callUUID: string) => void;
  onEndCall: (callUUID: string) => void;
  onMuteCall: (callUUID: string, muted: boolean) => void;
  onToggleHold: (callUUID: string, hold: boolean) => void;
}

// ============================================================================
// CallKeep Service
// ============================================================================

class CallKeepService {
  private isInitialized = false;
  private eventHandlers: Partial<CallKeepEvents> = {};
  private activeCallUUID: string | null = null;

  /**
   * Initialize CallKeep with app-specific configuration
   */
  initialize(appName: string): void {
    if (this.isInitialized) {
      console.log('CallKeep already initialized');
      return;
    }

    const options = {
      ios: {
        appName,
        supportsVideo: true,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: 'Permissions Required',
        alertDescription: 'This app needs access to your phone accounts',
        cancelButton: 'Cancel',
        okButton: 'OK',
        additionalPermissions: [],
        selfManaged: false,
      },
    };

    try {
      RNCallKeep.setup(options);
      this.setupEventHandlers();
      this.isInitialized = true;
      console.log('✅ CallKeep initialized');
    } catch (error) {
      console.error('❌ Failed to initialize CallKeep:', error);
    }
  }

  /**
   * Setup event handlers for CallKeep
   */
  private setupEventHandlers(): void {
    // User answered the call
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
      console.log('CallKeep: Answer call', callUUID);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      this.eventHandlers.onAnswerCall?.(callUUID);
    });

    // User ended the call
    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      console.log('CallKeep: End call', callUUID);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      this.eventHandlers.onEndCall?.(callUUID);
      this.activeCallUUID = null;
    });

    // User toggled mute
    RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ callUUID, muted }) => {
      console.log('CallKeep: Set muted', callUUID, muted);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      this.eventHandlers.onMuteCall?.(callUUID, muted);
    });

    // User toggled hold
    RNCallKeep.addEventListener('didToggleHoldCallAction', ({ callUUID, hold }) => {
      console.log('CallKeep: Toggle hold', callUUID, hold);
      this.eventHandlers.onToggleHold?.(callUUID, hold);
    });

    // iOS-specific events
    if (Platform.OS === 'ios') {
      RNCallKeep.addEventListener('didActivateAudioSession', () => {
        console.log('CallKeep: Audio session activated');
      });

      RNCallKeep.addEventListener('didDeactivateAudioSession', () => {
        console.log('CallKeep: Audio session deactivated');
      });
    }
  }

  /**
   * Register event handler
   */
  on<K extends keyof CallKeepEvents>(
    event: K,
    handler: CallKeepEvents[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Display incoming call UI
   */
  displayIncomingCall(options: CallOptions): void {
    if (!this.isInitialized) {
      console.error('CallKeep not initialized');
      return;
    }

    try {
      const { callUUID, callerName, isVideoCall } = options;

      RNCallKeep.displayIncomingCall(
        callUUID,
        callerName,
        callerName,
        'generic',
        isVideoCall
      );

      this.activeCallUUID = callUUID;
      console.log('✅ Incoming call displayed:', callUUID);

      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('❌ Failed to display incoming call:', error);
    }
  }

  /**
   * Start outgoing call
   */
  startCall(options: CallOptions): void {
    if (!this.isInitialized) {
      console.error('CallKeep not initialized');
      return;
    }

    try {
      const { callUUID, callerName, isVideoCall } = options;

      RNCallKeep.startCall(callUUID, callerName, callerName, 'generic', isVideoCall);
      this.activeCallUUID = callUUID;
      console.log('✅ Outgoing call started:', callUUID);
    } catch (error) {
      console.error('❌ Failed to start call:', error);
    }
  }

  /**
   * End call
   */
  endCall(callUUID: string): void {
    if (!this.isInitialized) {
      console.error('CallKeep not initialized');
      return;
    }

    try {
      RNCallKeep.endCall(callUUID);
      if (this.activeCallUUID === callUUID) {
        this.activeCallUUID = null;
      }
      console.log('✅ Call ended:', callUUID);
    } catch (error) {
      console.error('❌ Failed to end call:', error);
    }
  }

  /**
   * Report call connected
   */
  reportConnectedCall(callUUID: string): void {
    if (!this.isInitialized) {
      console.error('CallKeep not initialized');
      return;
    }

    try {
      RNCallKeep.reportConnectedOutgoingCallWithUUID(callUUID);
      console.log('✅ Call connected:', callUUID);
    } catch (error) {
      console.error('❌ Failed to report connected call:', error);
    }
  }

  /**
   * Update call display name
   */
  updateDisplay(callUUID: string, displayName: string): void {
    if (!this.isInitialized) {
      console.error('CallKeep not initialized');
      return;
    }

    try {
      RNCallKeep.updateDisplay(callUUID, displayName, displayName);
      console.log('✅ Call display updated:', callUUID);
    } catch (error) {
      console.error('❌ Failed to update call display:', error);
    }
  }

  /**
   * Set mute status
   */
  setMutedCall(callUUID: string, muted: boolean): void {
    if (!this.isInitialized) {
      console.error('CallKeep not initialized');
      return;
    }

    try {
      RNCallKeep.setMutedCall(callUUID, muted);
      console.log('✅ Call mute status set:', callUUID, muted);
    } catch (error) {
      console.error('❌ Failed to set mute status:', error);
    }
  }

  /**
   * Set on hold status
   */
  setOnHold(callUUID: string, hold: boolean): void {
    if (!this.isInitialized) {
      console.error('CallKeep not initialized');
      return;
    }

    try {
      RNCallKeep.setOnHold(callUUID, hold);
      console.log('✅ Call hold status set:', callUUID, hold);
    } catch (error) {
      console.error('❌ Failed to set hold status:', error);
    }
  }

  /**
   * Check if there's an active call
   */
  hasActiveCall(): boolean {
    return this.activeCallUUID !== null;
  }

  /**
   * Get active call UUID
   */
  getActiveCallUUID(): string | null {
    return this.activeCallUUID;
  }

  /**
   * Cleanup and remove all event listeners
   */
  cleanup(): void {
    if (!this.isInitialized) return;

    try {
      RNCallKeep.removeEventListener('answerCall');
      RNCallKeep.removeEventListener('endCall');
      RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
      RNCallKeep.removeEventListener('didToggleHoldCallAction');

      if (Platform.OS === 'ios') {
        RNCallKeep.removeEventListener('didActivateAudioSession');
        RNCallKeep.removeEventListener('didDeactivateAudioSession');
      }

      this.isInitialized = false;
      this.activeCallUUID = null;
      this.eventHandlers = {};
      console.log('✅ CallKeep cleaned up');
    } catch (error) {
      console.error('❌ Failed to cleanup CallKeep:', error);
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const callKeepService = new CallKeepService();

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Generate a unique call UUID
 */
export function generateCallUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if CallKeep is supported on this platform
 */
export function isCallKeepSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

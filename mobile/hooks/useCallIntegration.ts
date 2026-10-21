/**
 * Call Integration Hook
 * 
 * Integrates voice/video calls with CallKeep and Socket.io
 * Handles incoming call notifications and navigation
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { socketService } from '@/lib/socket';
import { callKeepService, generateCallUUID, isCallKeepSupported } from '@/lib/callkeep';

interface IncomingCallData {
  channelId: string;
  channelName: string;
  callerName: string;
  callType: 'voice' | 'video';
}

export function useCallIntegration() {
  const router = useRouter();
  const callUUIDRef = useRef<string | null>(null);
  const pendingCallRef = useRef<IncomingCallData | null>(null);

  /**
   * Handle incoming voice/video call
   */
  const handleIncomingCall = useCallback((data: IncomingCallData) => {
    console.log('Incoming call:', data);

    if (!isCallKeepSupported()) {
      // Fallback to alert if CallKeep not supported
      Alert.alert(
        `Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call`,
        `${data.callerName} is calling in ${data.channelName}`,
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () => {
              // Notify server of declined call
              const socket = socketService.getSocket();
              socket?.emit('call:declined', {
                channelId: data.channelId,
                callType: data.callType,
              });
            },
          },
          {
            text: 'Answer',
            onPress: () => {
              navigateToCall(data);
            },
          },
        ]
      );
      return;
    }

    // Use CallKeep for native call UI
    const callUUID = generateCallUUID();
    callUUIDRef.current = callUUID;
    pendingCallRef.current = data;

    callKeepService.displayIncomingCall({
      callUUID,
      callerName: `${data.callerName} - ${data.channelName}`,
      channelId: data.channelId,
      channelName: data.channelName,
      isVideoCall: data.callType === 'video',
    });
  }, []);

  /**
   * Navigate to appropriate call screen
   */
  const navigateToCall = useCallback((data: IncomingCallData) => {
    if (data.callType === 'video') {
      router.push({
        pathname: '/video-call',
        params: {
          channelId: data.channelId,
          channelName: data.channelName,
        },
      });
    } else {
      router.push({
        pathname: '/voice-call',
        params: {
          channelId: data.channelId,
          channelName: data.channelName,
        },
      });
    }
  }, [router]);

  /**
   * Start an outgoing call
   */
  const startCall = useCallback((channelId: string, channelName: string, callType: 'voice' | 'video') => {
    if (isCallKeepSupported()) {
      const callUUID = generateCallUUID();
      callUUIDRef.current = callUUID;

      callKeepService.startCall({
        callUUID,
        callerName: channelName,
        channelId,
        channelName,
        isVideoCall: callType === 'video',
      });
    }

    navigateToCall({ channelId, channelName, callerName: '', callType });
  }, [navigateToCall]);

  /**
   * End active call
   */
  const endCall = useCallback(() => {
    if (callUUIDRef.current) {
      callKeepService.endCall(callUUIDRef.current);
      callUUIDRef.current = null;
    }
    pendingCallRef.current = null;
  }, []);

  /**
   * Setup CallKeep and Socket.io event listeners
   */
  useEffect(() => {
    // Initialize CallKeep
    if (isCallKeepSupported()) {
      callKeepService.initialize('NexTalk');

      // Handle user answering call
      callKeepService.on('onAnswerCall', (callUUID) => {
        console.log('User answered call:', callUUID);
        const pendingCall = pendingCallRef.current;

        if (pendingCall) {
          navigateToCall(pendingCall);
          callKeepService.reportConnectedCall(callUUID);
        }
      });

      // Handle user ending call
      callKeepService.on('onEndCall', (callUUID) => {
        console.log('User ended call:', callUUID);
        const socket = socketService.getSocket();
        const pendingCall = pendingCallRef.current;

        if (pendingCall) {
          // Notify server
          socket?.emit('call:ended', {
            channelId: pendingCall.channelId,
            callType: pendingCall.callType,
          });
        }

        pendingCallRef.current = null;
        callUUIDRef.current = null;
      });

      // Handle mute toggle
      callKeepService.on('onMuteCall', (callUUID, muted) => {
        console.log('User toggled mute:', callUUID, muted);
        // This would need to be communicated to the active call screen
        // via a state management solution or event emitter
      });
    }

    // Setup Socket.io listeners
    const socket = socketService.getSocket();

    if (socket) {
      // Listen for incoming voice calls
      socket.on('voice:incomingCall', (data: any) => {
        handleIncomingCall({
          channelId: data.channelId,
          channelName: data.channelName,
          callerName: data.callerName,
          callType: 'voice',
        });
      });

      // Listen for incoming video calls
      socket.on('video:incomingCall', (data: any) => {
        handleIncomingCall({
          channelId: data.channelId,
          channelName: data.channelName,
          callerName: data.callerName,
          callType: 'video',
        });
      });

      // Listen for call ended by remote
      socket.on('call:remoteEnded', (data: any) => {
        console.log('Remote user ended call:', data);
        Alert.alert('Call Ended', 'The call has been ended by the remote user.');
        endCall();
      });
    }

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.off('voice:incomingCall');
        socket.off('video:incomingCall');
        socket.off('call:remoteEnded');
      }
    };
  }, [handleIncomingCall, navigateToCall, endCall]);

  return {
    startCall,
    endCall,
    hasActiveCall: callKeepService.hasActiveCall(),
  };
}

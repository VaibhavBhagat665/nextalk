import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import * as Notifications from 'expo-notifications';
import {
  configureNotifications,
  registerForPushNotifications,
  deactivatePushToken,
  setupNotificationListeners,
} from '../lib/notifications';

/**
 * Custom hook for managing push notifications
 * 
 * Automatically:
 * - Configures notification handling
 * - Registers for push tokens when user is authenticated
 * - Sends tokens to server
 * - Deactivates tokens on logout
 * - Sets up notification listeners
 * 
 * @returns Push notification state and control functions
 */
export function usePushNotifications() {
  const { isSignedIn, getToken } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  // Configure notification handling on mount
  useEffect(() => {
    configureNotifications();
  }, []);

  // Register for push notifications when user signs in
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    const register = async () => {
      setIsRegistering(true);
      setRegistrationError(null);

      try {
        // Get Clerk auth token
        const authToken = await getToken();
        if (!authToken) {
          throw new Error('Failed to get authentication token');
        }

        // Register for push notifications
        const token = await registerForPushNotifications(authToken);
        
        if (token) {
          setExpoPushToken(token);
          console.log('✅ Push notifications registered successfully');
        } else {
          setRegistrationError('Failed to register for push notifications');
        }
      } catch (error: any) {
        console.error('Error registering push notifications:', error);
        setRegistrationError(error.message || 'Registration failed');
      } finally {
        setIsRegistering(false);
      }
    };

    register();
  }, [isSignedIn, getToken]);

  // Set up notification listeners
  useEffect(() => {
    const cleanup = setupNotificationListeners(
      // Handle notification received while app is open
      (notification) => {
        setNotification(notification);
      },
      // Handle notification tapped
      (response) => {
        console.log('Notification tapped, data:', response.notification.request.content.data);
        // You can navigate to specific screens based on notification data here
        // Example: router.push(`/channel/${response.notification.request.content.data.channelId}`);
      }
    );

    return cleanup;
  }, []);

  // Deactivate token when user logs out
  useEffect(() => {
    if (!isSignedIn && expoPushToken) {
      const deactivate = async () => {
        try {
          const authToken = await getToken();
          if (authToken) {
            await deactivatePushToken(expoPushToken, authToken);
            console.log('✅ Push token deactivated');
          }
        } catch (error) {
          console.error('Error deactivating push token:', error);
        }
        setExpoPushToken(null);
      };

      deactivate();
    }
  }, [isSignedIn, expoPushToken, getToken]);

  // Retry registration if it failed
  const retryRegistration = useCallback(async () => {
    if (!isSignedIn) {
      setRegistrationError('User must be signed in');
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const authToken = await getToken();
      if (!authToken) {
        throw new Error('Failed to get authentication token');
      }

      const token = await registerForPushNotifications(authToken);
      
      if (token) {
        setExpoPushToken(token);
      } else {
        setRegistrationError('Failed to register for push notifications');
      }
    } catch (error: any) {
      console.error('Error retrying registration:', error);
      setRegistrationError(error.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  }, [isSignedIn, getToken]);

  return {
    expoPushToken,
    isRegistering,
    registrationError,
    notification,
    retryRegistration,
  };
}

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3000';

/**
 * Configure notification handling behavior
 * This determines how notifications are shown when app is in foreground
 */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Register for push notifications and obtain Expo push token
 * 
 * @param authToken - Clerk authentication token for API request
 * @returns Expo push token string or null if registration fails
 */
export async function registerForPushNotifications(
  authToken: string
): Promise<string | null> {
  try {
    // Check if running on physical device (push notifications don't work on simulator/emulator)
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push notification permissions');
      return null;
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('Expo project ID not found in app.json');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const expoPushToken = tokenData.data;
    console.log('📱 Expo push token:', expoPushToken);

    // Determine platform
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    // Send token to server
    const success = await sendPushTokenToServer(expoPushToken, platform, authToken);
    
    if (success) {
      console.log('✅ Push token registered with server');
      return expoPushToken;
    } else {
      console.error('❌ Failed to register push token with server');
      return null;
    }
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Send push token to backend server for storage
 * 
 * @param token - Expo push token
 * @param platform - Platform type ("ios" | "android")
 * @param authToken - Clerk authentication token
 * @returns true if successful, false otherwise
 */
async function sendPushTokenToServer(
  token: string,
  platform: 'ios' | 'android',
  authToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Server error registering push token:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('Server response:', data);
    return data.success === true;
  } catch (error) {
    console.error('Network error sending push token to server:', error);
    return false;
  }
}

/**
 * Deactivate push token when user logs out
 * 
 * @param token - Expo push token to deactivate
 * @param authToken - Clerk authentication token
 * @returns true if successful, false otherwise
 */
export async function deactivatePushToken(
  token: string,
  authToken: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_URL}/api/push/register?token=${encodeURIComponent(token)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to deactivate push token on server');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deactivating push token:', error);
    return false;
  }
}

/**
 * Set up notification received listeners
 * 
 * @param onNotificationReceived - Callback when notification is received while app is open
 * @param onNotificationTapped - Callback when notification is tapped to open app
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  // Listen for notifications received while app is open
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('🔔 Notification received:', notification);
      onNotificationReceived?.(notification);
    }
  );

  // Listen for when user taps on notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('👆 Notification tapped:', response);
      onNotificationTapped?.(response);
    }
  );

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Schedule a local notification (for testing purposes)
 * 
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional data payload
 */
export async function scheduleTestNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: {
      seconds: 2,
    },
  });
}

/**
 * Get notification badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

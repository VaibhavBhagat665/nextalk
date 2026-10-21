import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

// Create a new Expo SDK client
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

interface PushNotificationData {
  userId: string;
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send a push notification to a specific user's device
 * @param notification - Push notification data including user ID, token, title, body, and optional data payload
 * @returns Promise<boolean> - True if notification was sent successfully, false otherwise
 */
export async function sendPushNotification(
  notification: PushNotificationData
): Promise<boolean> {
  const { pushToken, title, body, data } = notification;

  // Check that the token is a valid Expo push token
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return false;
  }

  // Construct the push message
  const message: ExpoPushMessage = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data: data || {},
    priority: "high",
    badge: 1,
  };

  try {
    // Send the push notification
    const ticketChunk = await expo.sendPushNotificationsAsync([message]);
    const ticket = ticketChunk[0];

    // Check for errors in the ticket
    if (ticket.status === "error") {
      console.error(
        `Error sending push notification to ${notification.userId}:`,
        ticket.message
      );
      
      // If the token is invalid, we should remove it from the database
      if (ticket.details?.error === "DeviceNotRegistered") {
        console.warn(`Device token ${pushToken} is no longer registered`);
        // TODO: Remove invalid token from database
      }
      
      return false;
    }

    console.log(`✅ Push notification sent to ${notification.userId}: ${ticket.id}`);
    return true;
  } catch (error: any) {
    console.error(`Error sending push notification to ${notification.userId}:`, error);
    return false;
  }
}

/**
 * Send push notifications to multiple users at once
 * @param notifications - Array of push notification data
 * @returns Promise<number> - Number of successfully sent notifications
 */
export async function sendBatchPushNotifications(
  notifications: PushNotificationData[]
): Promise<number> {
  // Filter for valid Expo push tokens
  const validNotifications = notifications.filter((notif) =>
    Expo.isExpoPushToken(notif.pushToken)
  );

  if (validNotifications.length === 0) {
    console.warn("No valid push tokens in batch");
    return 0;
  }

  // Construct push messages
  const messages: ExpoPushMessage[] = validNotifications.map((notif) => ({
    to: notif.pushToken,
    sound: "default",
    title: notif.title,
    body: notif.body,
    data: notif.data || {},
    priority: "high",
    badge: 1,
  }));

  try {
    // Expo recommends sending notifications in chunks of 100
    const chunks = expo.chunkPushNotifications(messages);
    let successCount = 0;

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        
        // Count successful sends
        ticketChunk.forEach((ticket, index) => {
          if (ticket.status === "ok") {
            successCount++;
          } else if (ticket.status === "error") {
            const notif = validNotifications[index];
            console.error(
              `Error sending push to ${notif.userId}:`,
              ticket.message
            );
          }
        });
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }

    console.log(`✅ Sent ${successCount}/${validNotifications.length} push notifications`);
    return successCount;
  } catch (error: any) {
    console.error("Error sending batch push notifications:", error);
    return 0;
  }
}

/**
 * Check if a push token is valid and can receive notifications
 * @param pushToken - Expo push token to validate
 * @returns boolean - True if token is valid
 */
export function isValidPushToken(pushToken: string): boolean {
  return Expo.isExpoPushToken(pushToken);
}

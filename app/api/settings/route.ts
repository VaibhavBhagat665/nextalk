import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/settings — fetch user settings
export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get or create settings
    let settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: user.id },
      });
    }

    return NextResponse.json({
      ...settings,
      language: user.language,
      statusMessage: user.statusMessage,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error", message: error.message, stack: error.stack }, { status: 500 });
  }
}

// PATCH /api/settings — update user settings
export async function PATCH(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();

  // Separate user-level and settings-level fields
  const userFields: any = {};
  const settingsFields: any = {};

  if (body.language !== undefined) userFields.language = body.language;
  if (body.statusMessage !== undefined) userFields.statusMessage = body.statusMessage;
  if (body.username !== undefined) userFields.username = body.username;

  const settingsKeys = [
    "desktopNotifications", "soundAlerts", "muteAll", "dmNotificationsOnly",
    "showOnlineStatus", "readReceipts", "allowDmsFromNonMembers",
    "timeFormat", "dateFormat", "publicKey",
  ];

  for (const key of settingsKeys) {
    if (body[key] !== undefined) settingsFields[key] = body[key];
  }

  // Update user fields
  if (Object.keys(userFields).length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: userFields,
    });
  }

  // Upsert settings
  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: settingsFields,
    create: { userId: user.id, ...settingsFields },
  });

  return NextResponse.json(settings);
}

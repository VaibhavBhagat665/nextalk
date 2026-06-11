import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("CLERK_WEBHOOK_SECRET is not set");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, username, first_name, last_name, image_url } = evt.data;

    const email = email_addresses[0]?.email_address;
    const uname = username || email?.split("@")[0] || `user_${id.slice(-6)}`;

    await prisma.user.create({
      data: {
        clerkId: id,
        email: email || "",
        username: uname,
        firstName: first_name || null,
        lastName: last_name || null,
        imageUrl: image_url || null,
      },
    });

    // Auto-join general channel
    const generalChannel = await prisma.channel.findFirst({
      where: { name: "general" },
    });

    if (generalChannel) {
      const user = await prisma.user.findUnique({ where: { clerkId: id } });
      if (user) {
        await prisma.membership.create({
          data: {
            userId: user.id,
            channelId: generalChannel.id,
          },
        });
      }
    }

    console.log(`✅ User created: ${uname}`);
  }

  if (eventType === "user.updated") {
    const { id, email_addresses, username, first_name, last_name, image_url } = evt.data;

    await prisma.user.update({
      where: { clerkId: id },
      data: {
        email: email_addresses[0]?.email_address,
        username: username || undefined,
        firstName: first_name || null,
        lastName: last_name || null,
        imageUrl: image_url || null,
      },
    });
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    if (id) {
      await prisma.user.delete({ where: { clerkId: id } }).catch(() => {
        // User might already be deleted
      });
    }
  }

  return NextResponse.json({ success: true });
}

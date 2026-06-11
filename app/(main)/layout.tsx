import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  let user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) redirect("/sign-in");

    user = await prisma.user.create({
      data: {
        clerkId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        username:
          clerkUser.username ||
          clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] ||
          `user_${clerkId.slice(-6)}`,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
      },
    });
  }

  // Fetch servers and channels in parallel for faster loading
  const [serverMemberships, memberships] = await Promise.all([
    // Fetch user's servers
    prisma.serverMember.findMany({
      where: { userId: user.id },
      include: { server: true },
      orderBy: { joinedAt: "asc" },
    }),
    // Fetch all channels for the user (trimmed includes for speed)
    prisma.membership.findMany({
      where: { userId: user.id },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            serverId: true,
            icon: true,
            type: true,
            description: true,
            isPrivate: true,
            isDM: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { channel: { updatedAt: "desc" } },
    }),
  ]);

  const servers = serverMemberships.map((sm) => ({
    id: sm.server.id,
    name: sm.server.name,
    icon: sm.server.icon,
    role: sm.role,
    isOwner: sm.server.ownerId === user!.id,
    inviteCode: sm.server.inviteCode,
  }));

  const channels = memberships
    .filter((m) => !m.channel.isDM)
    .map((m) => ({
      id: m.channel.id,
      name: m.channel.name,
      serverId: m.channel.serverId,
      icon: m.channel.icon,
      type: m.channel.type || "text",
      description: m.channel.description,
      isPrivate: m.channel.isPrivate,
      isDM: m.channel.isDM,
      lastMessage: null,
      role: m.role,
      voiceUsers: [] as { id: string; username: string; imageUrl: string | null; muted: boolean }[],
    }));

  return (
    <Suspense fallback={<div className="loading-state">Loading workspace...</div>}>
      <AppShell servers={servers} channels={channels} currentUser={user}>
        {children}
      </AppShell>
    </Suspense>
  );
}

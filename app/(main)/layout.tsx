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

  let shouldRedirect = false;
  let layoutContent;

  try {
    let user = await prisma.user.findUnique({ where: { clerkId } });

    if (!user) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        shouldRedirect = true;
      } else {
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
    }

    if (!shouldRedirect && user) {
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

      layoutContent = (
        <Suspense fallback={<div className="loading-state">Loading workspace...</div>}>
          <AppShell servers={servers} channels={channels} currentUser={user}>
            {children}
          </AppShell>
        </Suspense>
      );
    }
  } catch (error: any) {
    // Return a direct server-rendered error UI to bypass Next.js client error scrubbing
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1A1714', color: '#F2EDE7', padding: '24px', fontFamily: 'monospace' }}>
        <h1 style={{ color: '#F43F5E', marginBottom: '16px', fontSize: '24px' }}>Raw Server Error Captured</h1>
        <p style={{ color: '#8A827A', marginBottom: '24px', maxWidth: '800px', textAlign: 'center' }}>
          Next.js hides server errors in production, so we caught this manually to show you what went wrong. Please take a screenshot of this and share it.
        </p>
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '24px', borderRadius: '12px', maxWidth: '800px', width: '100%', overflowX: 'auto', border: '1px solid #3f3f46' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '8px', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '1px' }}>Message:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginBottom: '24px', fontSize: '14px' }}>{error?.message || String(error)}</pre>
          <h2 style={{ fontSize: '16px', marginBottom: '8px', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '1px' }}>Stack Trace:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#a1a1aa' }}>{error?.stack}</pre>
        </div>
      </div>
    );
  }

  if (shouldRedirect) {
    redirect("/sign-in");
  }

  return layoutContent;
}

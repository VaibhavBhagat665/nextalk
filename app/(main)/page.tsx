import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Rocket } from "lucide-react";

export default async function MainPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) redirect("/sign-in");

  // Find general channel or first channel
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { channel: true },
    orderBy: { channel: { name: "asc" } },
  });

  if (membership) {
    redirect(`/channel/${membership.channel.id}`);
  }

  // No channels - show welcome
  return (
    <div className="welcome">
      <div className="welcome-content animate-fade-in">
        <div className="welcome-icon"><Rocket size={64} /></div>
        <h1 className="gradient-text">Welcome to NexTalk</h1>
        <p>Create a channel to start chatting!</p>
      </div>
      <style jsx>{`
        .welcome { flex:1; display:flex; align-items:center; justify-content:center; }
        .welcome-content { text-align:center; }
        .welcome-icon { color: var(--accent-gold); opacity: 0.8; margin-bottom:16px; }
        h1 { font-size:28px; margin-bottom:8px; }
        p { color:var(--text-tertiary); font-size:16px; }
      `}</style>
    </div>
  );
}

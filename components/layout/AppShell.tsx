"use client";

import { useSearchParams, usePathname } from "next/navigation";
import WorkspaceNav from "@/components/layout/WorkspaceNav";
import Sidebar from "@/components/sidebar/Sidebar";

export default function AppShell({
  children,
  servers,
  channels,
  currentUser,
}: {
  children: React.ReactNode;
  servers: any[];
  channels: any[];
  currentUser: any;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const requestedServerId = searchParams.get("server");
  
  let activeServerId = requestedServerId && servers.find((s) => s.id === requestedServerId)
    ? requestedServerId
    : null;

  if (!activeServerId && pathname.startsWith("/channel/")) {
    const channelId = pathname.split("/channel/")[1];
    const channel = channels.find(c => c.id === channelId);
    if (channel && channel.serverId) {
      activeServerId = channel.serverId;
    }
  }

  const activeServer = activeServerId ? servers.find((s) => s.id === activeServerId) : undefined;

  const filteredChannels = channels.filter((m) => {
    if (activeServerId) return m.serverId === activeServerId;
    return !m.serverId; // DMs
  });

  return (
    <div className="app-shell">
      <WorkspaceNav
        currentUser={currentUser}
        servers={servers}
        activeServerId={activeServerId}
      />
      <div className="col-separator" />
      <Sidebar
        channels={filteredChannels}
        currentUser={currentUser}
        serverName={activeServer?.name}
        serverId={activeServerId}
        serverInviteCode={activeServer?.inviteCode}
      />
      <div className="col-separator" />
      <main className="app-main">
        {children}
      </main>

      <style jsx>{`
        .app-shell {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background: var(--bg-primary);
        }
        .col-separator {
          width: 1px;
          height: 100vh;
          background: var(--gradient-divider);
          flex-shrink: 0;
          opacity: 0.5;
        }
        .app-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg-primary);
          position: relative;
          min-width: 0;
        }
        @media (max-width: 768px) {
          .col-separator { display: none; }
        }
      `}</style>
    </div>
  );
}

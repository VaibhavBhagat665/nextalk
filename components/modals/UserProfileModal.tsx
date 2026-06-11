"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, MessageSquare, Loader2, UserX } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface Profile {
  id: string;
  username: string;
  imageUrl: string | null;
  statusMessage: string | null;
  allowDmsFromNonMembers: boolean;
}

export default function UserProfileModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/users/${userId}/profile`)
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const handleMessage = () => {
    if (!profile) return;
    router.push(`/dm/${profile.id}`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-[#1a1714] border border-[#d4a23c]/20 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
          {/* Header Banner */}
          <div className="h-24 bg-gradient-to-r from-[#d4a23c]/20 to-purple-500/20 relative">
            <button onClick={onClose} className="absolute top-3 right-3 bg-black/40 text-white/70 hover:text-white p-1.5 rounded-full transition-colors">
              <X size={16} />
            </button>
          </div>
          
          <div className="px-6 pb-6 relative">
            {/* Avatar */}
            <div className="absolute -top-12 left-6 p-1 bg-[#1a1714] rounded-full">
              {loading ? (
                <div className="w-20 h-20 bg-white/5 rounded-full animate-pulse" />
              ) : profile?.imageUrl ? (
                <img src={profile.imageUrl} alt={profile.username} className="w-20 h-20 rounded-full object-cover border-2 border-[#d4a23c]/30" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#d4a23c] to-[#fceb9e] flex items-center justify-center text-2xl font-bold text-[#1a1400]">
                  {getInitials(profile?.username || "U")}
                </div>
              )}
            </div>

            <div className="pt-12">
              {loading ? (
                <div className="flex flex-col gap-2">
                  <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
                  <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                </div>
              ) : !profile ? (
                <div className="text-center py-4 text-zinc-400">User not found</div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">{profile.username}</h2>
                    {profile.statusMessage && (
                      <p className="text-sm text-zinc-400 mt-1">{profile.statusMessage}</p>
                    )}
                  </div>

                  <div className="h-px w-full bg-white/5" />

                  {profile.allowDmsFromNonMembers ? (
                    <button onClick={handleMessage} className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#d4a23c] hover:bg-[#c59537] text-[#1a1400] font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(212,162,60,0.2)]">
                      <MessageSquare size={16} />
                      Send Message
                    </button>
                  ) : (
                    <button disabled className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 text-zinc-500 font-semibold rounded-xl cursor-not-allowed">
                      <UserX size={16} />
                      DMs Disabled by User
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

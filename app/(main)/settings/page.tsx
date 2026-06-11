"use client";

import { useUser, useClerk, UserProfile } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor,
  Bell,
  Shield,
  Globe,
  LogOut,
  ChevronRight,
  Check,
  Laptop,
  Users,
  User,
  Trash2,
  BellOff,
  Eye,
  Lock,
  Volume2,
  Clock,
  Calendar,
  Key,
  ArrowLeft,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface UserSettings {
  desktopNotifications: boolean;
  soundAlerts: boolean;
  muteAll: boolean;
  dmNotificationsOnly: boolean;
  showOnlineStatus: boolean;
  readReceipts: boolean;
  allowDmsFromNonMembers: boolean;
  language: string;
  timeFormat: string;
  dateFormat: string;
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { theme, setTheme, systemTheme } = useTheme();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("account");
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(console.error);
  }, []);

  const updateSetting = async (key: keyof UserSettings, value: any) => {
    if (!settings) return;
    
    // Optimistic update
    setSettings({ ...settings, [key]: value });
    setSaving(true);
    
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value })
      });
    } catch (error) {
      console.error("Failed to update setting", error);
    } finally {
      setSaving(false);
    }
  };

  const currentTheme = theme === "system" ? systemTheme : theme;

  const tabs = [
    { id: "account", label: "My Account", icon: User },
    { id: "appearance", label: "Appearance", icon: Moon },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Security", icon: Shield },
    { id: "language", label: "Language & Region", icon: Globe },
  ];

  if (!isLoaded || !mounted) return <div className="settings-page loading">Loading...</div>;

  return (
    <div className="settings-page">
      <header className="settings-header glass">
        <button className="back-btn" onClick={() => router.back()} id="settings-back-btn">
          <ArrowLeft size={18} />
        </button>
        <div className="header-icon">
          <SettingsIcon size={20} />
        </div>
        <h1>Settings</h1>
        {saving && <span className="save-indicator">Saving...</span>}
      </header>

      <div className="settings-content">
        {/* Left Column — Navigation */}
        <div className="settings-sidebar">
          <div className="profile-card card">
            {user?.imageUrl ? (
              <Image src={user.imageUrl} alt="Profile" width={64} height={64} className="profile-img" />
            ) : (
              <div className="profile-fallback">
                {user?.username?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="profile-info">
              <h2>{user?.username}</h2>
              <p>{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <button className="btn-ghost edit-profile-btn" onClick={() => document.getElementById("clerk-user-button")?.click()}>
              Edit Profile
            </button>
          </div>

          <nav className="settings-nav card">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
            
            <div className="nav-divider" />
            
            <button className="nav-item danger" onClick={() => signOut()}>
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </nav>
        </div>

        {/* Right Column — Content */}
        <div className="settings-main">
          {activeTab === "account" && (
            <div className="settings-section animate-fade-in">
              <h2>My Account</h2>
              <p className="section-desc">Manage your profile details and security.</p>
              
              <div className="user-profile-container">
                <UserProfile 
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "bg-transparent shadow-none w-full max-w-full",
                      navbar: "hidden",
                      pageScrollBox: "p-0",
                    }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="settings-section animate-fade-in">
              <h2>Theme</h2>
              <p className="section-desc">Customize the look and feel of NexTalk.</p>
              
              <div className="theme-grid">
                <button
                  className={`theme-btn ${theme === "system" ? "active" : ""}`}
                  onClick={() => setTheme("system")}
                >
                  <div className="theme-preview theme-preview--system">
                    <div className="preview-split">
                      <div className="preview-half preview-half--dark" />
                      <div className="preview-half preview-half--light" />
                    </div>
                    <Laptop size={20} className="preview-icon" />
                  </div>
                  <div className="theme-info">
                    <Monitor size={14} />
                    <span>System Sync</span>
                    {theme === "system" && <Check size={14} className="theme-check" />}
                  </div>
                </button>

                <button
                  className={`theme-btn ${theme === "light" ? "active" : ""}`}
                  onClick={() => setTheme("light")}
                >
                  <div className="theme-preview theme-preview--light">
                    <div className="preview-bar preview-bar--light" />
                    <div className="preview-content">
                      <div className="preview-sidebar-mini preview-sidebar-mini--light" />
                      <div className="preview-chat-mini">
                        <div className="preview-line preview-line--light" />
                        <div className="preview-line preview-line--light preview-line--short" />
                        <div className="preview-line preview-line--light preview-line--med" />
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <Sun size={14} />
                    <span>Warm Linen</span>
                    {theme === "light" && <Check size={14} className="theme-check" />}
                  </div>
                </button>

                <button
                  className={`theme-btn ${theme === "dark" ? "active" : ""}`}
                  onClick={() => setTheme("dark")}
                >
                  <div className="theme-preview theme-preview--dark">
                    <div className="preview-bar preview-bar--dark" />
                    <div className="preview-content">
                      <div className="preview-sidebar-mini preview-sidebar-mini--dark" />
                      <div className="preview-chat-mini">
                        <div className="preview-line preview-line--dark" />
                        <div className="preview-line preview-line--dark preview-line--short" />
                        <div className="preview-line preview-line--dark preview-line--med" />
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <Moon size={14} />
                    <span>Deep Obsidian</span>
                    {theme === "dark" && <Check size={14} className="theme-check" />}
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && settings && (
            <div className="settings-section animate-fade-in">
              <h2>Notifications</h2>
              <p className="section-desc">Manage how and when you receive alerts.</p>

              <div className="card settings-list-card">
                <div className="settings-list">
                  <div className="settings-row">
                    <div className="settings-row-icon"><Monitor size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Desktop Notifications</span>
                      <span className="settings-row-desc">Receive push notifications on this device</span>
                    </div>
                    <div className="settings-row-action">
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={settings.desktopNotifications} 
                          onChange={(e) => updateSetting("desktopNotifications", e.target.checked)} 
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-icon"><Volume2 size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Sound Alerts</span>
                      <span className="settings-row-desc">Play a sound for incoming messages</span>
                    </div>
                    <div className="settings-row-action">
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={settings.soundAlerts} 
                          onChange={(e) => updateSetting("soundAlerts", e.target.checked)} 
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-icon"><BellOff size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Mute All</span>
                      <span className="settings-row-desc">Pause all notifications temporarily</span>
                    </div>
                    <div className="settings-row-action">
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={settings.muteAll} 
                          onChange={(e) => updateSetting("muteAll", e.target.checked)} 
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "privacy" && settings && (
            <div className="settings-section animate-fade-in">
              <h2>Privacy & Security</h2>
              <p className="section-desc">Control your visibility and message security.</p>

              <div className="card settings-list-card">
                <div className="settings-list">
                  <div className="settings-row">
                    <div className="settings-row-icon"><Eye size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Show Online Status</span>
                      <span className="settings-row-desc">Let others see when you are active</span>
                    </div>
                    <div className="settings-row-action">
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={settings.showOnlineStatus} 
                          onChange={(e) => updateSetting("showOnlineStatus", e.target.checked)} 
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-icon"><Check size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Read Receipts</span>
                      <span className="settings-row-desc">Show when you have read a message</span>
                    </div>
                    <div className="settings-row-action">
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={settings.readReceipts} 
                          onChange={(e) => updateSetting("readReceipts", e.target.checked)} 
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-icon"><Shield size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Allow DMs from Non-Members</span>
                      <span className="settings-row-desc">Anyone can send you a direct message</span>
                    </div>
                    <div className="settings-row-action">
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={settings.allowDmsFromNonMembers} 
                          onChange={(e) => updateSetting("allowDmsFromNonMembers", e.target.checked)} 
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="section-subtitle">End-to-End Encryption</h3>
              <div className="card settings-list-card">
                <div className="settings-list">
                  <div className="settings-row">
                    <div className="settings-row-icon"><Lock size={16} className="text-gold" /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Encryption Keys</span>
                      <span className="settings-row-desc">Your DMs are secured with AES-256-GCM. Export your keys to backup your chats.</span>
                    </div>
                    <div className="settings-row-action">
                      <button className="btn-gold" style={{ height: 32, padding: "0 12px", fontSize: 13 }}>
                        Export Keys
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "language" && settings && (
            <div className="settings-section animate-fade-in">
              <h2>Language & Region</h2>
              <p className="section-desc">Customize your locale preferences.</p>

              <div className="card settings-list-card">
                <div className="settings-list">
                  <div className="settings-row">
                    <div className="settings-row-icon"><Globe size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Display Language</span>
                    </div>
                    <div className="settings-row-action">
                      <select 
                        className="dropdown"
                        value={settings.language}
                        onChange={(e) => updateSetting("language", e.target.value)}
                      >
                        <option value="en">English (US)</option>
                        <option value="hi">Hindi</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ja">Japanese</option>
                      </select>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-icon"><Clock size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Time Format</span>
                    </div>
                    <div className="settings-row-action">
                      <select 
                        className="dropdown"
                        value={settings.timeFormat}
                        onChange={(e) => updateSetting("timeFormat", e.target.value)}
                      >
                        <option value="12h">12-hour (1:00 PM)</option>
                        <option value="24h">24-hour (13:00)</option>
                      </select>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-icon"><Calendar size={16} /></div>
                    <div className="settings-row-info">
                      <span className="settings-row-label">Date Format</span>
                    </div>
                    <div className="settings-row-action">
                      <select 
                        className="dropdown"
                        value={settings.dateFormat}
                        onChange={(e) => updateSetting("dateFormat", e.target.value)}
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .settings-page {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg-primary);
        }

        .settings-header {
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--border-primary);
          z-index: 10;
        }

        .back-btn {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .back-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--accent-gold);
        }

        .save-indicator {
          margin-left: auto;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-gold);
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .header-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-gold-dim);
          color: var(--accent-gold);
          border-radius: 8px;
        }

        .settings-header h1 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .settings-content {
          flex: 1;
          overflow-y: auto;
          display: flex;
          padding: 32px 48px;
          gap: 40px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        /* Sidebar */
        .settings-sidebar {
          width: 280px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .profile-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .profile-img {
          border-radius: 50%;
          border: 2px solid var(--accent-gold-dim);
          margin-bottom: 16px;
        }

        .profile-fallback {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: #1a1400;
          margin-bottom: 16px;
        }

        .profile-info h2 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .profile-info p {
          font-size: 13px;
          color: var(--text-tertiary);
          margin-bottom: 16px;
        }

        .edit-profile-btn {
          width: 100%;
          border: 1px solid var(--border-primary);
        }

        .settings-nav {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--bg-active);
          color: var(--text-primary);
        }

        .nav-item.active svg {
          color: var(--accent-gold);
        }

        .nav-divider {
          height: 1px;
          background: var(--border-primary);
          margin: 8px 12px;
        }

        .nav-item.danger {
          color: var(--accent-rose);
        }

        .nav-item.danger:hover {
          background: rgba(244, 63, 94, 0.08);
        }

        /* Main Content */
        .settings-main {
          flex: 1;
          max-width: 700px;
        }

        .settings-section h2 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .section-desc {
          font-size: 14px;
          color: var(--text-tertiary);
          margin-bottom: 32px;
        }

        .section-subtitle {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 32px 0 16px;
        }

        .text-gold {
          color: var(--accent-gold);
        }

        /* Theme Grid */
        .theme-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .theme-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          border-radius: var(--radius-lg);
          overflow: hidden;
          text-align: left;
        }

        .theme-preview {
          height: 140px;
          border-radius: var(--radius-lg);
          border: 2px solid var(--border-primary);
          margin-bottom: 12px;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.2s var(--ease-smooth);
        }

        .theme-btn:hover .theme-preview {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .theme-btn.active .theme-preview {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 1px var(--accent-gold), var(--shadow-glow);
        }

        /* System preview */
        .theme-preview--system {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1C1917, #F2EDE7);
        }

        .preview-split {
          position: absolute;
          inset: 0;
          display: flex;
        }

        .preview-half { width: 50%; }
        .preview-half--dark { background: #1C1917; }
        .preview-half--light { background: #F2EDE7; }

        .preview-icon {
          position: relative;
          z-index: 1;
          color: rgba(139, 125, 107, 0.8);
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        /* Light preview */
        .theme-preview--light { background: #F2EDE7; }
        .preview-bar--light { height: 16px; background: #E8E0D5; border-bottom: 1px solid #D4CBC0; }
        .preview-sidebar-mini--light { width: 40px; height: 100%; background: #E0D8CC; }
        .preview-content { display: flex; flex: 1; }
        .preview-chat-mini { flex: 1; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
        .preview-line--light { height: 8px; border-radius: 4px; background: #D4CBC0; }
        .preview-line--short { width: 60% !important; }
        .preview-line--med { width: 80% !important; }

        /* Dark preview */
        .theme-preview--dark { background: #1C1917; }
        .preview-bar--dark { height: 16px; background: #292524; border-bottom: 1px solid #3A3530; }
        .preview-sidebar-mini--dark { width: 40px; height: 100%; background: #252220; }
        .preview-line--dark { height: 8px; border-radius: 4px; background: #3A3530; }

        /* Theme info */
        .theme-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .theme-check {
          color: var(--accent-gold);
          margin-left: auto;
        }

        /* Toggles */
        .toggle {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        
        .toggle input { 
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          transition: .4s;
          border-radius: 34px;
        }
        
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 2px;
          bottom: 2px;
          background-color: var(--text-muted);
          transition: .4s;
          border-radius: 50%;
        }
        
        input:checked + .slider {
          background-color: var(--accent-gold);
          border-color: var(--accent-gold);
        }
        
        input:checked + .slider:before {
          background-color: #fff;
          transform: translateX(16px);
        }

        /* Settings List */
        .settings-list-card {
          padding: 0;
          overflow: hidden;
        }

        .settings-list {
          display: flex;
          flex-direction: column;
        }

        .settings-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-primary);
        }

        .settings-row:last-child {
          border-bottom: none;
        }

        .settings-row-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--bg-active);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }

        .settings-row-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .settings-row-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .settings-row-desc {
          font-size: 13px;
          color: var(--text-tertiary);
          margin-top: 2px;
        }

        .dropdown {
          background: var(--bg-active);
          border: 1px solid var(--border-primary);
          color: var(--text-primary);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          outline: none;
          cursor: pointer;
        }
        
        .dropdown:focus {
          border-color: var(--accent-gold);
        }

        @media (max-width: 900px) {
          .settings-content {
            flex-direction: column;
            padding: 24px;
          }
          
          .settings-sidebar {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

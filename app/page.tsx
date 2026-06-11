import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  MessageSquare, Shield, Sparkles, Zap, ArrowRight, Lock, Users, Globe,
  Video, Mic, FileText, Brain, CheckCircle2, Star, Download, QrCode
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./landing.css";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/channel");

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-orb landing-orb--1" />
      <div className="landing-orb landing-orb--2" />
      <div className="landing-orb landing-orb--3" />

      {/* ── Navigation ── */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <div className="logo-icon bg-transparent">
            <Image src="/logo.png" alt="NexTalk Logo" width={28} height={28} />
          </div>
          <span className="gradient-text">NexTalk</span>
        </div>
        <div className="nav-links">
          <Link href="/sign-in" className="btn-ghost">Sign In</Link>
          <Link href="/sign-up" className="btn-primary gold-shimmer">Get Started <ArrowRight size={16} /></Link>
        </div>
      </nav>

      <main>
        {/* ── Hero Section ── */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge animate-fade-in" style={{ animationDelay: "0ms" }}>
              <Sparkles size={14} />
              AI-Powered Team Communication
            </div>
            <h1 className="hero-title animate-fade-in" style={{ animationDelay: "80ms" }}>
              Where teams<br />
              <span className="gradient-text">connect & create.</span>
            </h1>
            <p className="hero-desc animate-fade-in" style={{ animationDelay: "160ms" }}>
              Real-time messaging, HD video calls, AI-powered chat summaries, and enterprise-grade encryption — all in one beautiful platform built for modern teams.
            </p>
            <div className="hero-cta animate-fade-in" style={{ animationDelay: "240ms" }}>
              <Link href="/sign-up" className="btn-primary btn-lg gold-shimmer">
                Start Free <ArrowRight size={18} />
              </Link>
              <Link href="/sign-in" className="btn-outline btn-lg">
                Sign In
              </Link>
            </div>
            <div className="trust-bar animate-fade-in" style={{ animationDelay: "360ms" }}>
              <span className="trust-item"><Lock size={14} /> E2E Encrypted</span>
              <span className="trust-dot" />
              <span className="trust-item"><Globe size={14} /> Real-time WebSockets</span>
              <span className="trust-dot" />
              <span className="trust-item"><Users size={14} /> Team Channels</span>
            </div>
          </div>

          {/* App Mockup */}
          <div className="hero-visual animate-fade-in" style={{ animationDelay: "300ms" }}>
            <div className="mockup-glow" />
            <div className="mockup-frame">
              <Image
                src="/app-mockup.png"
                alt="NexTalk - Premium AI-Powered Chat Interface"
                width={900}
                height={560}
                className="mockup-img"
                priority
              />
            </div>
          </div>
        </section>

        {/* ── Features Grid ── */}
        <section className="features-section">
          <div className="section-header animate-fade-in">
            <span className="section-badge"><Star size={12} /> Core Features</span>
            <h2>Everything your team needs,<br /><span className="gradient-text">nothing it doesn't.</span></h2>
            <p>Powerful features designed for seamless collaboration, wrapped in a stunning interface.</p>
          </div>

          <div className="features-grid">
            <div className="feature-card feature-card--highlight animate-fade-in" style={{ animationDelay: "100ms" }}>
              <div className="feature-icon feature-icon--gold"><Sparkles size={24} /></div>
              <h3>AI Co-Pilot</h3>
              <p>Smart chat summaries, action items extraction, and context-aware analysis powered by Llama AI. Understands images, docs, and conversations.</p>
              <div className="feature-tags">
                <span className="feature-tag">Summaries</span>
                <span className="feature-tag">Action Items</span>
                <span className="feature-tag">Topics</span>
              </div>
            </div>

            <div className="feature-card animate-fade-in" style={{ animationDelay: "150ms" }}>
              <div className="feature-icon feature-icon--amber"><Zap size={24} /></div>
              <h3>Instant Messaging</h3>
              <p>Sub-100ms delivery via WebSockets. Rich text, reactions, file sharing, and typing indicators — all in real-time.</p>
            </div>

            <div className="feature-card animate-fade-in" style={{ animationDelay: "200ms" }}>
              <div className="feature-icon feature-icon--cyan"><Video size={24} /></div>
              <h3>Video & Voice Calls</h3>
              <p>Crystal-clear HD video calls and voice channels with WebRTC. Screen share, mute controls, and multi-user support.</p>
            </div>

            <div className="feature-card animate-fade-in" style={{ animationDelay: "250ms" }}>
              <div className="feature-icon feature-icon--emerald"><Shield size={24} /></div>
              <h3>Enterprise Security</h3>
              <p>AES-256-GCM encryption with isolated channels, role-based access control, and private server invites.</p>
            </div>

            <div className="feature-card animate-fade-in" style={{ animationDelay: "300ms" }}>
              <div className="feature-icon feature-icon--rose"><Users size={24} /></div>
              <h3>Server & Channels</h3>
              <p>Discord-style servers with text and voice channels. Create teams, invite members, and organize conversations your way.</p>
            </div>

            <div className="feature-card animate-fade-in" style={{ animationDelay: "350ms" }}>
              <div className="feature-icon feature-icon--purple"><FileText size={24} /></div>
              <h3>File Sharing</h3>
              <p>Share images, documents, PDFs and more with drag-and-drop uploads. Preview files inline without leaving the chat.</p>
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="how-section">
          <div className="section-header animate-fade-in">
            <span className="section-badge"><CheckCircle2 size={12} /> Simple Setup</span>
            <h2>Up and running in<br /><span className="gradient-text">3 simple steps.</span></h2>
          </div>

          <div className="steps">
            <div className="step animate-fade-in" style={{ animationDelay: "100ms" }}>
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Create Your Server</h3>
                <p>Sign up for free and create your team server in seconds. No credit card required.</p>
              </div>
            </div>
            <div className="step-connector" />
            <div className="step animate-fade-in" style={{ animationDelay: "200ms" }}>
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Invite Your Team</h3>
                <p>Share an invite code and your team joins instantly. Set roles and permissions as needed.</p>
              </div>
            </div>
            <div className="step-connector" />
            <div className="step animate-fade-in" style={{ animationDelay: "300ms" }}>
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Start Collaborating</h3>
                <p>Chat, call, share files, and let AI summarize your conversations. It is that simple.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="cta-section animate-fade-in">
          <div className="cta-glow" />
          <div className="cta-content">
            <h2>Ready to transform your<br /><span className="gradient-text">team communication?</span></h2>
            <p>Join thousands of teams already using NexTalk for faster, smarter collaboration.</p>
            <Link href="/sign-up" className="btn-primary btn-xl gold-shimmer">
              Get Started Free <ArrowRight size={20} />
            </Link>
          </div>
        </section>

        {/* ── Download Mobile App Section ── */}
        <section className="download-section animate-fade-in" style={{ padding: '6rem 2rem', textAlign: 'center' }}>
          <div className="section-header">
            <span className="section-badge"><Download size={12} /> Mobile App</span>
            <h2>Take NexTalk<br /><span className="gradient-text">Anywhere you go.</span></h2>
            <p>Download the Android APK to stay connected on the move.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', marginTop: '2rem' }}>
            <div style={{ padding: '1rem', background: 'var(--surface-sunken)', borderRadius: '1rem', border: '1px solid var(--border-subtle)' }}>
              <QRCodeSVG 
                value="https://your-website.com/nextalk.apk" 
                size={160}
                bgColor="#151515"
                fgColor="#D4AF37"
                level="Q"
                includeMargin={true}
                style={{ borderRadius: '0.5rem' }}
              />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Scan the QR code to download directly</p>
            <a href="/nextalk.apk" download className="btn-outline btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={18} /> Download APK Directly
            </a>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="landing-footer">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="logo-icon logo-icon--sm bg-transparent">
                <Image src="/logo.png" alt="NexTalk Logo" width={20} height={20} />
              </div>
              <span className="gradient-text">NexTalk</span>
            </div>
            <p className="footer-copy">© 2026 NexTalk. Built with Next.js, Socket.io & Llama AI.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

import { SignIn } from "@clerk/nextjs";

/**
 * SignInPage — Premium Clerk sign-in styled with the gold/taupe design system.
 * Uses CSS variable-based overrides instead of Tailwind utility classes.
 */
export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: {
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-primary)",
            borderWidth: "1px",
            boxShadow: "var(--shadow-lg)",
            borderRadius: "var(--radius-xl)",
          },
          headerTitle: { color: "var(--text-primary)" },
          headerSubtitle: { color: "var(--text-tertiary)" },
          socialButtonsBlockButton: {
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border-primary)",
            color: "var(--text-primary)",
            "&:hover": {
              backgroundColor: "var(--bg-hover)",
            },
          },
          formFieldLabel: { color: "var(--text-secondary)" },
          formFieldInput: {
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border-primary)",
            color: "var(--text-primary)",
            "&:focus": {
              borderColor: "var(--accent-gold)",
              boxShadow: "0 0 0 3px rgba(212, 162, 60, 0.10)",
            },
          },
          footerActionLink: { color: "var(--accent-gold)" },
          formButtonPrimary: {
            background: "var(--gradient-gold)",
            color: "#1a1400",
            "&:hover": {
              boxShadow: "var(--shadow-glow)",
            },
          },
        },
      }}
    />
  );
}

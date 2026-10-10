import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Shared shell for the Terms and the Privacy Policy.
 *
 * Deliberately plain and high-contrast: these are documents people need to be
 * able to actually read, and a legal page that is hard to read is a legal page
 * that is hard to enforce.
 */

export const LEGAL_EFFECTIVE = "9 October 2026";
export const LEGAL_ENTITY = "Amplifier Health, Inc.";
export const LEGAL_EMAIL = "privacy@serasona.com";

interface LegalDocProps {
  title: string;
  summary: string;
  children: ReactNode;
}

export const LegalDoc = ({ title, summary, children }: LegalDocProps) => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <div className="px-6 py-14 md:py-20">
      <article className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
          Effective {LEGAL_EFFECTIVE}
        </p>
        <h1 className="mt-2 font-serif text-4xl text-foreground">{title}</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">{summary}</p>

        <div
          className="mt-10 space-y-6 text-[15px] leading-relaxed text-foreground/90
                     [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-foreground [&_h2]:mt-12 [&_h2]:mb-3
                     [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-7 [&_h3]:mb-2
                     [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc
                     [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
        >
          {children}
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            Questions about this document: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </p>
          <p className="mt-2">
            <Link to="/terms">Terms of Service</Link>
            {" · "}
            <Link to="/privacy">Privacy Policy</Link>
            {" · "}
            <Link to="/">Home</Link>
          </p>
        </div>
      </article>
    </div>
  </div>
);

export default LegalDoc;

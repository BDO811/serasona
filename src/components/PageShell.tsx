import { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Puts the site chrome above a page.
 *
 * Applied at the route level rather than inside each page so that adding or
 * removing the header is one decision in one file, and so a page cannot
 * accidentally ship without it. The homepage is excluded because it renders
 * its own overlay header against a full-bleed hero, and the capture and result
 * screens are excluded on purpose: once someone is recording or reading a
 * result, navigation out of it is a distraction and those screens carry their
 * own exits.
 */
export const PageShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    {children}
  </div>
);

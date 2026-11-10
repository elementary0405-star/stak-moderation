import type { Metadata } from "next";
import "./globals.css";
import PortalShell from "@/components/portal/PortalShell";
export const metadata: Metadata = { title: "STAK Moderation Center", description: "Staff and moderation workspace for STAK." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body><PortalShell>{children}</PortalShell></body></html>; }

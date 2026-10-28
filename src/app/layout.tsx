import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LIKELEMBA — Ensemble, avançons",
    template: "%s · LIKELEMBA",
  },
  description:
    "LIKELEMBA aide les responsables de groupes de likelemba à gérer membres, cycles, cotisations et tours, en toute transparence.",
  applicationName: "LIKELEMBA",
};

export const viewport: Viewport = {
  themeColor: "#146B50",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

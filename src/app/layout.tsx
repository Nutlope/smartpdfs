import GithubIcon from "@/components/icons/github";
import XIcon from "@/components/icons/x";
import Logo from "@/components/ui/logo";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Link from "next/link";
import PlausibleProvider from "next-plausible";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "Smart PDFs | Summarize PDFs in seconds",
  description:
    "Upload a PDF to get a quick, clear, and shareable summary with AI for free!",
  openGraph: {
    images: "https://smartpdfs.vercel.app/og.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <PlausibleProvider domain="smartpdfs.ai" />
      </head>
      <body
        className={`${font.variable} flex min-h-full flex-col bg-gray-100 font-[family-name:var(--font-plus-jakarta-sans)] text-gray-900 antialiased`}
      >
        <header className="py-6 text-center">
          <Link href="/" className="inline-flex justify-center">
            <Logo />
          </Link>
        </header>

        <main className="grow overflow-hidden">{children}</main>
        <Toaster />
        <footer className="mx-auto mt-14 flex w-full max-w-7xl items-center justify-between px-4 py-6 md:mt-0">
          <p className="text-xs text-gray-300 md:text-sm">
            Powered by Llama 3.3 on{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 underline transition hover:text-gray-900"
              href="https://togetherai.link/?utm_source=smartpdfs&utm_medium=referral&utm_campaign=example-app"
            >
              Together AI
            </a>
          </p>

          <div className="flex items-center gap-2 md:gap-3">
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-250 bg-white px-2 py-1.5 text-xs text-gray-300 shadow transition hover:bg-white/75 md:rounded-xl md:px-4 md:text-sm"
              href="https://github.com/nutlope/smartpdfs"
            >
              <GithubIcon className="size-4" />
              GitHub
            </a>
            <a
              href="https://x.com/nutlope"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-250 bg-white px-2 py-1.5 text-xs text-gray-300 shadow transition hover:bg-white/75 md:rounded-xl md:px-4 md:text-sm"
            >
              <XIcon className="size-3" />
              Twitter
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}

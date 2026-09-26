import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};
import { Source_Serif_4, Public_Sans } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Legal AI Workspace | Grounded Legal Document Analysis",
  description:
    "Enterprise-grade AI legal assistant. Analyze contracts, extract risk profiles, compare clauses, and get grounded answers with paragraph-level citations — zero hallucinations.",
  keywords: [
    "legal AI",
    "contract analysis",
    "document comparison",
    "legal risk detection",
    "AI legal assistant",
    "clause extraction",
    "legal tech",
  ],
  authors: [{ name: "Vaibhav A Jain" }],
  openGraph: {
    title: "Legal AI Workspace",
    description:
      "AI-powered legal document analysis with grounded, citation-backed answers.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isProd = process.env.NODE_ENV === "production";
  const isMockMode =
    process.env.MOCK_MODE === "true" ||
    (process.env.MOCK_MODE !== "false" && !isProd);
  const showMockBanner = isProd && isMockMode;

  return (
    <html lang="en">
      <body
        className={`${publicSans.variable} ${sourceSerif.variable} font-sans antialiased flex flex-col h-screen`}
      >
        {showMockBanner && (
          <div
            role="alert"
            className="bg-risk text-white text-center py-2 font-bold z-50 w-full shadow-md shrink-0"
          >
            ⚠️ MOCK_MODE is enabled in production. Set MOCK_MODE=false and
            provide a valid GEMINI_API_KEY.
          </div>
        )}
        <div className="flex-1 overflow-hidden">{children}</div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Source_Serif_4, Public_Sans } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: "Grounded Legal Document Assistant",
  description: "AI for Legal Assistance with exact citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isProd = process.env.NODE_ENV === "production";
  const isMockMode = process.env.MOCK_MODE === "true" || (process.env.MOCK_MODE !== "false" && !isProd);
  const showMockBanner = isProd && isMockMode;

  return (
    <html lang="en">
      <body className={`${publicSans.variable} ${sourceSerif.variable} font-sans antialiased flex flex-col h-screen`}>
        {showMockBanner && (
          <div className="bg-risk text-white text-center py-2 font-bold z-50 w-full shadow-md shrink-0">
            ERROR: MOCK_MODE is enabled in production! The deployed/submitted version must run with MOCK_MODE=false and a valid key.
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}

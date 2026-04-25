import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Context Split · bunq Hackathon",
  description: "AI-powered bill splitting with bunq payment requests",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-bunq-dark text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}

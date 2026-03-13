import type { Metadata } from "next"
import { Inter, Outfit } from "next/font/google"
import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
})

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
})

export const metadata: Metadata = {
  title: "Planning Poker Online - Scrum Poker for Agile Teams",
  description: "Easy-to-use and fun estimations for agile teams. Vote and estimate issues in real-time with beautiful card animations.",
  keywords: ["planning poker", "scrum poker", "agile", "estimation", "story points"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className={`${inter.variable} ${outfit.variable}`}>{children}</body>
    </html>
  )
}

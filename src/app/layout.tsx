import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

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
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

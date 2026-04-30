import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "织梦录 — AI 互动叙事",
  description: "AI 驱动的开放世界文字交互游戏，书写属于你的故事。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

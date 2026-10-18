import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = {
  title: "INNOVIA — Independent fashion, beautifully connected.",
  description:
    "Discover considered collections from independent Moroccan boutiques.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

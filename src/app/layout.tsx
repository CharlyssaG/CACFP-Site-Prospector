import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CACFP Site Prospector — KidKare",
  description:
    "Identify childcare centers eligible for the USDA Child and Adult Care Food Program. Search by city, county, state, or ZIP code. Check sponsorship status and contact information.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

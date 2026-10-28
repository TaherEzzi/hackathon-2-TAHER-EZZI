import type { Metadata } from "next";
import { ThemeStudio } from "@/components/ThemeStudio";

export const metadata: Metadata = { title: "Theme Studio — BreezePost" };

export default function ThemesPage() {
  return <ThemeStudio />;
}

import type { Metadata } from "next";
import { IdentityForm } from "@/components/IdentityForm";

export const metadata: Metadata = { title: "Identity — BreezePost" };

export default function IdentityPage() {
  return <IdentityForm />;
}

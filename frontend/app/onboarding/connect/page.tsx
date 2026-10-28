import type { Metadata } from "next";
import { ConnectPanel } from "@/components/ConnectPanel";

export const metadata: Metadata = { title: "Connect — BreezePost" };

export default function ConnectPage() {
  return <ConnectPanel />;
}

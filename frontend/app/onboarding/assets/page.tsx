import type { Metadata } from "next";
import { AssetLocker } from "@/components/AssetLocker";

export const metadata: Metadata = { title: "Asset Locker — BreezePost" };

export default function AssetsPage() {
  return <AssetLocker />;
}

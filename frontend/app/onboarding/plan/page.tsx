"use client";

import { PlanStage } from "@/components/PlanStage";
import { useOnboarding } from "@/components/onboarding-context";

export default function PlanPage() {
  const { profile, patchProfile } = useOnboarding();
  return (
    <div className="w-full px-6 lg:px-12 pb-16 flex-1 flex flex-col justify-center items-center max-w-6xl mx-auto">
      <PlanStage profile={profile} patchProfile={patchProfile} />
    </div>
  );
}

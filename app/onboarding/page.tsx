import Link from "next/link";
import { Brain } from "lucide-react";
import { getOnboardingState } from "./actions";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const state = await getOnboardingState();

  return (
    <main className="grid min-h-screen place-items-center bg-black px-5 py-12 text-white">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white text-black">
            <Brain className="size-4" />
          </span>
          Company Brain
        </Link>
        {state.companyReady ? (
          <div className="rounded-lg border border-white/10 bg-[#111111] p-6">
            <h1 className="text-2xl font-semibold">Workspace ready</h1>
            <p className="mt-2 text-neutral-400">Your company memory bank is provisioned.</p>
            <Link className="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-medium text-black" href="/connect">
              Continue
            </Link>
          </div>
        ) : (
          <OnboardingForm state={state} />
        )}
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";

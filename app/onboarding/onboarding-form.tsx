"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeCompanyBrain, createCompanyBrain, type OnboardingState } from "./actions";

export function OnboardingForm({ state }: { state: OnboardingState }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(state.companyName ?? state.orgName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const result = state.hasOrg
      ? await completeCompanyBrain(companyName)
      : await createCompanyBrain(companyName);

    if (result.success) {
      router.push("/connect");
      router.refresh();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Set up Company Brain</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-400">
        Provision a Hindsight bank and bind it to your Clerk organization.
      </p>
      <div className="mt-6 space-y-3">
        <label className="text-sm text-neutral-300" htmlFor="company-name">
          Company name
        </label>
        <Input
          id="company-name"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          className="h-10 border-white/10 bg-black text-white"
        />
      </div>
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {!state.canProvision && state.hasOrg ? (
        <p className="mt-4 text-sm text-amber-300">Only organization admins can complete setup.</p>
      ) : null}
      <Button
        className="mt-6 w-full bg-white text-black hover:bg-[#F5F5F5]"
        disabled={loading || !companyName.trim() || (state.hasOrg && !state.canProvision)}
        onClick={() => void submit()}
      >
        {loading ? "Provisioning..." : state.provisioningFailed ? "Retry provisioning" : "Complete setup"}
      </Button>
    </div>
  );
}

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-black px-5 py-12">
      <SignUp fallbackRedirectUrl="/onboarding" signInUrl="/sign-in" />
    </main>
  );
}

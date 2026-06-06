import { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq, members } from "@/lib/db";
import { db } from "@/lib/db";
import { getCompanyByClerkOrgId } from "@/lib/company";

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return new Response("Verification failed", { status: 400 });
  }

  try {
    if (evt.type === "organizationMembership.created") {
      const company = await getCompanyByClerkOrgId(evt.data.organization.id);
      if (!company) return new Response("OK", { status: 200 });

      await db
        .insert(members)
        .values({
          clerkUserId: evt.data.public_user_data.user_id,
          companyId: company.id,
          clerkRole: evt.data.role,
          email: evt.data.public_user_data.identifier ?? null,
        })
        .onConflictDoUpdate({
          target: members.clerkUserId,
          set: {
            companyId: company.id,
            clerkRole: evt.data.role,
            email: evt.data.public_user_data.identifier ?? null,
          },
        });
    }

    if (evt.type === "organizationMembership.deleted") {
      await db.delete(members).where(eq(members.clerkUserId, evt.data.public_user_data.user_id));
    }

    if (evt.type === "user.updated") {
      const email = evt.data.email_addresses[0]?.email_address ?? null;
      if (email) await db.update(members).set({ email }).where(eq(members.clerkUserId, evt.data.id));
    }
  } catch (err) {
    console.error(`Clerk webhook handler error for ${evt.type}:`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

export const dynamic = "force-dynamic";

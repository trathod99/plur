import { NextResponse } from "next/server";
import { gatherAndScoreEvents } from "@/lib/aggregate-events";
import { readProfile } from "@/lib/profile-store";

export async function GET() {
  const profile = await readProfile();
  const { events, warnings } = await gatherAndScoreEvents(profile);
  return NextResponse.json({ events, warnings, profile });
}

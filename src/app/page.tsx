import { readProfile } from "@/lib/profile-store";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await readProfile();
  return <HomeClient initialProfile={profile} />;
}

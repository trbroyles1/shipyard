import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SIGN_IN_PATH } from "@/lib/constants";
import { Dashboard } from "@/components/Dashboard";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  return <Dashboard />;
}

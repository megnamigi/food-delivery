import { AuthScreen } from "@/components/auth/auth-screen";
export const metadata = { title: "Verify email — NomNom" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthScreen
      kind="verify"
      token={typeof params.token === "string" ? params.token : ""}
    />
  );
}

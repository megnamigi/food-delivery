import { AuthScreen } from "@/components/auth/auth-screen";
export const metadata = { title: "Create new password — NomNom" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthScreen
      kind="reset"
      token={typeof params.token === "string" ? params.token : ""}
    />
  );
}

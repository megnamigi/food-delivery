import { AuthScreen } from "@/components/auth/auth-screen";
export const metadata = { title: "Create your account — NomNom" };
export default function Page() {
  return <AuthScreen kind="signup" />;
}

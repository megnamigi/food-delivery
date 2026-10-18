import { AuthScreen } from "@/components/auth/auth-screen";
export const metadata = { title: "Log in — NomNom" };
export default function Page() {
  return <AuthScreen kind="login" />;
}

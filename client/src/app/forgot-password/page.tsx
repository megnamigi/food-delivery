import { AuthScreen } from "@/components/auth/auth-screen";
export const metadata = { title: "Reset password — NomNom" };
export default function Page() {
  return <AuthScreen kind="forgot" />;
}

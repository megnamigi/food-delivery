import { AdminFrame } from "@/components/admin/admin-frame";
import "./admin.css";
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminFrame>{children}</AdminFrame>;
}

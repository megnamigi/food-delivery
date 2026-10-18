import Image from "next/image";
import type { ReactNode } from "react";
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-form">{children}</div>
      </section>
      <div className="auth-image-wrap">
        <Image
          src="/images/courier.jpg"
          alt="NomNom courier delivering food by bicycle on a city street"
          width={1400}
          height={1600}
          loading="eager"
        />
      </div>
    </main>
  );
}

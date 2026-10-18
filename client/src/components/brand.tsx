import Image from "next/image";
import Link from "next/link";
export function Brand({ stacked = false }: { stacked?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${stacked ? "brand-stacked" : ""}`}
      aria-label="NomNom home"
    >
      <Image src="/images/logo.svg" alt="" width={46} height={38} />
      <span>
        <b>
          Nom<span>Nom</span>
        </b>
        <small>Swift delivery</small>
      </span>
    </Link>
  );
}

import Image from "next/image";
import Link from "next/link";

export function LogoMunicipal({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="focus-ring flex shrink-0 items-center rounded-lg" aria-label="Ir al inicio">
      <Image src="/logo-mpt.png" alt="Municipalidad Provincial de Trujillo" width={compact ? 128 : 196} height={compact ? 128 : 196} priority className={compact ? "h-16 w-auto" : "h-24 w-auto"} />
    </Link>
  );
}

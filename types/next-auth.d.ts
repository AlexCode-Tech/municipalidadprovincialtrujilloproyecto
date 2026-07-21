import "next-auth";
import type { DefaultSession } from "next-auth";
import type { Rol } from "@/lib/constantes";

declare module "next-auth" {
  interface User { rol: Rol }
  interface Session {
    user: { id: string; rol: Rol; iat?: number } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT { rol?: Rol }
}

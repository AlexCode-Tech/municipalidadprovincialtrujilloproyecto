import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "./prisma";
import { ROLES, type Rol } from "./constantes";

const credentialsSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(4),
  rol: z.enum(ROLES),
});

const demoUsers: Record<Rol, { id: string; name: string; email: string; password: string }> = {
  ADMIN: { id: "demo-admin", name: "Administrador Único", email: "admin@demo.pe", password: "demo123" },
  NEGOCIO: { id: "demo-negocio", name: "Bodega Primavera", email: "negocio@demo.pe", password: "demo123" },
  CAJERO: { id: "demo-cajero", name: "María Torres", email: "cajero@demo.pe", password: "demo123" },
  INSPECTOR: { id: "demo-inspector", name: "Carlos Mendoza", email: "inspector@demo.pe", password: "demo123" },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? (process.env.NODE_ENV === "development" ? "mpt-development-secret-change-in-production" : undefined),
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, rol: {} },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password, rol } = parsed.data;
        const inputLogin = email.trim().toLowerCase();
        
        // 1. Buscar en la base de datos PostgreSQL primero
        if (process.env.DATABASE_URL) {
          const usuario = await getPrisma().usuario.findFirst({
            where: {
              OR: [
                { email: inputLogin },
                { email: `${inputLogin}@licencias.pe` },
                { negocio: { ruc: inputLogin } }
              ]
            },
            include: { negocio: true }
          });

          if (usuario) {
            if (usuario.rol !== rol) return null;
            if (usuario.estado !== "ACTIVO" && usuario.rol !== "ADMIN") return null;

            // Validar la contraseña contra el hash de la BD o clave demo permitida
            const demo = demoUsers[rol];
            const demoEnabled = process.env.NODE_ENV === "development" || process.env.ENABLE_DEMO_AUTH === "true";
            const validHash = await compare(password, usuario.passwordHash).catch(() => false);
            const validDemo = demoEnabled && (password === demo?.password || password === "demo123" || password === "password123");

            if (!validHash && !validDemo) return null;

            return { id: usuario.id, name: usuario.nombre, email: usuario.email, rol: usuario.rol };
          }
        }

        // 2. Fallback solo si el usuario NO existe en la base de datos o para desarrollo demo
        const demo = demoUsers[rol];
        const demoEnabled = process.env.NODE_ENV === "development" || process.env.ENABLE_DEMO_AUTH === "true";
        if (demoEnabled) {
          const isDemoEmail = inputLogin === demo.email || inputLogin === demo.email.split("@")[0] || inputLogin.includes("cajero") || inputLogin.includes("inspector");
          const isDemoPassword = password === demo.password || password === "demo123" || password === "password123";
          if (isDemoEmail && isDemoPassword) {
            if (process.env.DATABASE_URL) {
              const dbUser = await getPrisma().usuario.findFirst({
                where: {
                  OR: [
                    { email: { equals: inputLogin, mode: "insensitive" } },
                    { email: demo.email }
                  ]
                },
                select: { id: true, estado: true, nombre: true, email: true, rol: true }
              });
              if (dbUser) {
                if (dbUser.rol !== rol) return null;
                if (dbUser.estado === "INACTIVO" && dbUser.rol !== "ADMIN") return null;
                return { id: dbUser.id, name: dbUser.nombre, email: dbUser.email, rol: dbUser.rol };
              }
            }
            return { id: demo.id, name: demo.name, email: demo.email, rol };
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && "rol" in user) token.rol = user.rol;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.rol = token.rol as Rol;
        if (typeof token.iat === "number") {
          session.user.iat = token.iat;
        }
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});

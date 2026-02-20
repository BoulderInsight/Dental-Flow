import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, userPractices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 15 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        if (!user) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          practiceId: user.practiceId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Resolve default practice from userPractices join table
        const [defaultPractice] = await db
          .select({
            practiceId: userPractices.practiceId,
            role: userPractices.role,
          })
          .from(userPractices)
          .where(
            and(
              eq(userPractices.userId, user.id as string),
              eq(userPractices.isDefault, true)
            )
          )
          .limit(1);

        if (defaultPractice) {
          token.practiceId = defaultPractice.practiceId;
          token.role = defaultPractice.role;
        } else {
          // Fallback: pick first practice membership
          const [anyPractice] = await db
            .select({
              practiceId: userPractices.practiceId,
              role: userPractices.role,
            })
            .from(userPractices)
            .where(eq(userPractices.userId, user.id as string))
            .limit(1);

          if (anyPractice) {
            token.practiceId = anyPractice.practiceId;
            token.role = anyPractice.role;
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.practiceId = token.practiceId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});

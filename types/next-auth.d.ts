import "next-auth";

declare module "next-auth" {
  interface User {
    practiceId: string;
    role: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      practiceId: string;
      role: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    practiceId?: string;
    role?: string;
  }
}

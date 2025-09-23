import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      orgId: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    orgId: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    orgId: string;
  }
}




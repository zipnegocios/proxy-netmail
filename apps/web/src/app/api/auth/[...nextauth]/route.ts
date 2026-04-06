import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@proxy-netmail.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        if (
          credentials?.email === adminEmail &&
          credentials?.password === adminPassword
        ) {
          return { id: '1', email: credentials.email, name: 'Admin' };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt' as const,
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

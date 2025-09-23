# 🔐 Authentication System

This document describes the NextAuth.js authentication system implemented in the Social App frontend.

## 🚀 Features

- ✅ **Email/Password Authentication** - Secure login with bcrypt password hashing
- ✅ **Prisma Integration** - User data stored in SQLite/PostgreSQL database
- ✅ **Session Management** - JWT-based sessions with userId and orgId
- ✅ **Protected Routes** - Middleware protection for API routes and pages
- ✅ **User Registration** - Signup with organization assignment
- ✅ **Type Safety** - Full TypeScript support with custom types
- ✅ **Responsive UI** - Clean, mobile-friendly login/signup pages

## 🏗️ Architecture

### Database Schema
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?   // Hashed with bcrypt
  orgId         String    // Organization identifier
  name          String?
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  posts         Post[]
  leads         Lead[]
  ads           Ad[]
  notifications Notification[]
}
```

### Session Structure
```typescript
interface Session {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    orgId: string; // Custom field for organization
  };
}
```

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file:
```bash
cp env.example .env.local
```

Update `.env.local` with your configuration:
```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key-here"

# API URLs
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_SOCIAL_API_URL="http://localhost:5000"
```

### 3. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Create database and tables
npx prisma db push

# Seed with sample data (optional)
npx prisma db seed
```

### 4. Start Development Server
```bash
npm run dev
```

## 📱 Pages & Routes

### Public Pages
- `/` - Home page (redirects to dashboard if authenticated)
- `/auth/signin` - Login page
- `/auth/signup` - Registration page

### Protected Pages
- `/dashboard` - Main dashboard (requires authentication)
- `/posts` - Posts management
- `/composer` - Post creation
- `/analytics` - Analytics dashboard
- `/notifications-test` - Notification testing

### API Routes
- `/api/auth/[...nextauth]` - NextAuth.js endpoints
- `/api/auth/signup` - User registration
- `/api/protected/*` - Protected API routes (require authentication)

## 🔒 Authentication Flow

### 1. User Registration
```typescript
// POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "orgId": "org_123"
}
```

### 2. User Login
```typescript
// POST /api/auth/signin
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### 3. Session Access
```typescript
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <p>Loading...</p>;
  if (!session) return <p>Not authenticated</p>;
  
  return <p>Welcome, {session.user.email}!</p>;
}
```

## 🛡️ Security Features

### Password Security
- **bcrypt Hashing** - Passwords are hashed with bcrypt (12 salt rounds)
- **No Plain Text Storage** - Passwords are never stored in plain text
- **Secure Comparison** - Password verification uses bcrypt.compare()

### Session Security
- **JWT Tokens** - Secure JSON Web Tokens for session management
- **HttpOnly Cookies** - Session cookies are not accessible via JavaScript
- **CSRF Protection** - Built-in CSRF protection via NextAuth.js
- **Secure Headers** - Proper security headers for all requests

### Route Protection
- **Middleware Protection** - Automatic protection for all routes except auth pages
- **API Route Guards** - Server-side session validation for API routes
- **Client-side Guards** - React hooks for client-side authentication checks

## 🔧 Usage Examples

### Protecting a Page
```typescript
'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.push('/auth/signin');
  }, [session, status, router]);

  if (status === 'loading') return <div>Loading...</div>;
  if (!session) return null;

  return <div>Protected content for {session.user.email}</div>;
}
```

### Protecting an API Route
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return Response.json({ 
    message: 'Protected data',
    user: session.user 
  });
}
```

### Accessing User Data
```typescript
import { useSession } from 'next-auth/react';

function UserProfile() {
  const { data: session } = useSession();
  
  if (!session) return <div>Not logged in</div>;
  
  return (
    <div>
      <h1>Welcome, {session.user.name}!</h1>
      <p>Email: {session.user.email}</p>
      <p>Organization: {session.user.orgId}</p>
    </div>
  );
}
```

## 🧪 Testing

### Manual Testing
1. **Registration Test**
   - Visit `/auth/signup`
   - Create a new account
   - Verify redirect to dashboard

2. **Login Test**
   - Visit `/auth/signin`
   - Login with existing credentials
   - Verify session persistence

3. **Protected Route Test**
   - Try accessing `/dashboard` without authentication
   - Verify redirect to login page

4. **API Protection Test**
   - Make request to `/api/protected/example` without session
   - Verify 401 Unauthorized response

### Sample Test Data
```typescript
// Test user credentials (if seeded)
{
  email: "admin@socialapp.com",
  password: "hashed_password_123",
  orgId: "org_123"
}
```

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid credentials" error**
   - Check if user exists in database
   - Verify password hashing is working
   - Check email format

2. **Session not persisting**
   - Verify NEXTAUTH_SECRET is set
   - Check NEXTAUTH_URL configuration
   - Clear browser cookies and try again

3. **Database connection errors**
   - Verify DATABASE_URL is correct
   - Check if database file exists (SQLite)
   - Run `npx prisma db push` to create tables

4. **TypeScript errors**
   - Run `npx prisma generate` to update types
   - Check if all dependencies are installed
   - Verify tsconfig.json configuration

### Debug Mode
Enable debug logging by setting:
```env
NEXTAUTH_DEBUG=true
```

## 📚 API Reference

### NextAuth.js Configuration
```typescript
// lib/auth.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [/* ... */],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.orgId = user.orgId;
      return token;
    },
    session: ({ session, token }) => {
      if (token) {
        session.user.id = token.sub!;
        session.user.orgId = token.orgId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
};
```

### Middleware Configuration
```typescript
// middleware.ts
export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith('/auth/')) return true;
        if (req.nextUrl.pathname === '/') return true;
        return !!token;
      },
    },
  }
);
```

## 🔄 Migration Guide

### From Basic Auth to NextAuth.js
1. Install NextAuth.js dependencies
2. Update database schema with NextAuth tables
3. Migrate existing users to new schema
4. Update authentication logic in components
5. Test all authentication flows

### Database Migration
```bash
# Create migration
npx prisma migrate dev --name "add-nextauth-tables"

# Apply migration
npx prisma migrate deploy
```

## 📈 Performance Considerations

- **Session Caching** - Sessions are cached in memory for performance
- **Database Indexing** - Proper indexes on email and orgId fields
- **JWT Size** - Keep JWT payload minimal for better performance
- **Connection Pooling** - Prisma handles database connection pooling

## 🔐 Security Best Practices

1. **Environment Variables** - Never commit secrets to version control
2. **Password Requirements** - Enforce strong password policies
3. **Rate Limiting** - Implement rate limiting for auth endpoints
4. **HTTPS Only** - Use HTTPS in production
5. **Session Timeout** - Implement appropriate session timeouts
6. **Audit Logging** - Log authentication events for security monitoring

## 🎉 Conclusion

The authentication system provides a secure, scalable foundation for the Social App. It includes all necessary features for user management, session handling, and route protection while maintaining excellent developer experience and type safety.

For additional help or questions, refer to the [NextAuth.js documentation](https://next-auth.js.org/) or the [Prisma documentation](https://www.prisma.io/docs/).




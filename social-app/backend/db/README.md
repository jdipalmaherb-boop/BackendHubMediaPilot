# Social App Database

This directory contains the Prisma ORM setup for the Social App backend database.

## 🗄️ Database Schema

The database includes the following models:

- **User** - User accounts with email, password, and organization ID
- **Post** - Social media posts with file URLs, captions, and scheduling
- **Ad** - Advertising campaigns linked to posts
- **LandingPage** - Marketing landing pages
- **Lead** - Captured leads from landing pages
- **Notification** - System notifications for users

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` to configure your database URL:

```env
# For SQLite (default)
DATABASE_URL="file:./dev.db"

# For PostgreSQL (production)
DATABASE_URL="postgresql://username:password@localhost:5432/social_app_db?schema=public"
```

### 3. Run Migration

```bash
# Run the complete migration with seeding
npm run migrate

# Or run individual commands
npm run generate    # Generate Prisma client
npm run db:push     # Push schema to database
npm run db:seed     # Seed with sample data
```

### 4. View Data (Optional)

```bash
npm run studio      # Open Prisma Studio
```

## 📋 Available Scripts

- `npm run generate` - Generate Prisma client
- `npm run migrate` - Run complete migration with seeding
- `npm run migrate:deploy` - Deploy migrations (production)
- `npm run migrate:reset` - Reset database and run migrations
- `npm run studio` - Open Prisma Studio
- `npm run db:push` - Push schema changes to database
- `npm run db:pull` - Pull schema from existing database
- `npm run db:seed` - Seed database with sample data

## 🏗️ Database Structure

### User Model
```prisma
model User {
  id             String          @id @default(cuid())
  email          String          @unique
  password       String
  orgId          String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  
  posts          Post[]
  leads          Lead[]
  ads            Ad[]
  notifications  Notification[]
}
```

### Post Model
```prisma
model Post {
  id            String   @id @default(cuid())
  fileUrl       String
  caption       String
  platforms     String[] // Array of platform names
  scheduledDate DateTime?
  status        String   // pending, scheduled, published
  orgId         String
  userId        String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  ads  Ad[]
}
```

### Ad Model
```prisma
model Ad {
  id         String   @id @default(cuid())
  postId     String
  campaignId String
  budget     Float
  status     String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
}
```

### LandingPage Model
```prisma
model LandingPage {
  id        String   @id @default(cuid())
  orgId     String
  headline  String
  subtext   String
  ctaText   String
  ctaUrl    String
  url       String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  leads Lead[]
}
```

### Lead Model
```prisma
model Lead {
  id            String   @id @default(cuid())
  name          String
  email         String
  phone         String?
  landingPageId String
  orgId         String
  userId        String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  landingPage LandingPage  @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
}
```

### Notification Model
```prisma
model Notification {
  id        String   @id @default(cuid())
  orgId     String
  type      String
  message   String
  timestamp DateTime @default(now())
  read      Boolean  @default(false)
  userId    String

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## 🔧 Usage in Code

```typescript
import { db } from './database';

// Create a new user
const user = await db.createUser({
  email: 'user@example.com',
  password: 'hashed_password',
  orgId: 'org_123',
});

// Create a post
const post = await db.createPost({
  fileUrl: 'https://example.com/image.jpg',
  caption: 'Check this out! #awesome',
  platforms: ['instagram', 'facebook'],
  status: 'published',
  orgId: 'org_123',
  userId: user.id,
});

// Get posts for an organization
const posts = await db.getPostsByOrg('org_123');

// Create a notification
const notification = await db.createNotification({
  orgId: 'org_123',
  type: 'post_published',
  message: 'Post published successfully!',
  userId: user.id,
});
```

## 🗃️ Database Providers

### SQLite (Default)
- **File**: `dev.db`
- **Best for**: Development, testing, small applications
- **Pros**: No setup required, portable, fast for small datasets
- **Cons**: Limited concurrent writes, not suitable for production

### PostgreSQL (Production)
- **Best for**: Production applications
- **Pros**: ACID compliance, concurrent writes, advanced features
- **Cons**: Requires setup, more complex

## 🔄 Migrations

### Development
```bash
# Make schema changes in schema.prisma
# Then run:
npm run db:push
```

### Production
```bash
# Create migration files
npx prisma migrate dev --name "add_new_field"

# Deploy migrations
npm run migrate:deploy
```

## 🧪 Testing

The database includes sample data for testing:

- 2 users across 2 organizations
- 2 sample posts with different statuses
- 2 ad campaigns
- 2 landing pages
- 3 leads
- 3 notifications

## 📊 Analytics

The database service includes analytics methods:

```typescript
// Get post statistics
const postStats = await db.getPostStats('org_123');
// Returns: { total, published, scheduled, pending }

// Get lead statistics
const leadStats = await db.getLeadStats('org_123');
// Returns: { total, thisWeek, thisMonth }

// Get ad statistics
const adStats = await db.getAdStats('org_123');
// Returns: { total, totalBudget, active }
```

## 🚨 Important Notes

1. **Password Hashing**: In production, always hash passwords before storing
2. **Environment Variables**: Never commit `.env` files to version control
3. **Database Backups**: Regular backups are essential for production
4. **Indexes**: The schema includes optimized indexes for common queries
5. **Relations**: All relations use proper foreign keys with cascade deletes

## 🆘 Troubleshooting

### Common Issues

1. **Database locked**: SQLite database is locked by another process
   - Solution: Close Prisma Studio or other database connections

2. **Migration failed**: Schema changes conflict with existing data
   - Solution: Reset database with `npm run migrate:reset`

3. **Client not generated**: Prisma client is out of date
   - Solution: Run `npm run generate`

### Getting Help

- Check Prisma documentation: https://www.prisma.io/docs/
- View database with Prisma Studio: `npm run studio`
- Check logs for detailed error messages




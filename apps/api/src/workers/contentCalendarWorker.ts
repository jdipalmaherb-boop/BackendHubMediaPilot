import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';

/**
 * Generate content calendar reminders based on user profile
 */
async function generateContentReminders(userId: string): Promise<void> {
  try {
    // Get user profile enhancement
    const profile = await prisma.userProfileEnhancement.findUnique({
      where: { userId },
    });

    if (!profile) {
      return; // No profile, skip
    }

    // Get user's business strategy
    const strategy = await prisma.businessStrategy.findFirst({
      where: {
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!strategy || !strategy.contentCalendar) {
      return; // No strategy, skip
    }

    const contentCalendar = strategy.contentCalendar as any[];
    const today = new Date();
    const currentWeek = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Find content for current and next week
    const upcomingContent = contentCalendar.filter((week: any) => {
      const weekNumber = week.week || 0;
      return weekNumber >= currentWeek && weekNumber <= currentWeek + 1;
    });

    if (upcomingContent.length === 0) {
      return;
    }

    // Create reminders for upcoming content
    for (const week of upcomingContent) {
      const topics = week.topics || [];
      const formats = week.formats || [];
      const platforms = week.platforms || [];

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        const format = formats[i] || 'Feed Post';
        const platform = platforms[i] || profile.preferredPlatforms[0] || 'instagram';

        // Check if reminder already exists
        const existingReminder = await prisma.notification.findFirst({
          where: {
            orgId: userId, // Using userId as orgId for simplicity
            type: 'content_reminder',
            message: { contains: topic },
            timestamp: {
              gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        });

        if (existingReminder) {
          continue; // Reminder already sent
        }

        // Create reminder notification
        await prisma.notification.create({
          data: {
            orgId: userId,
            type: 'content_reminder',
            message: `📅 Content Reminder: Create a ${format} about "${topic}" for ${platform}`,
            timestamp: new Date(),
            metadata: {
              week: week.week,
              theme: week.theme,
              topic,
              format,
              platform,
              strategyId: strategy.id,
            },
          },
        });
      }
    }

    log.info('Content calendar reminders generated', {
      userId,
      remindersCount: upcomingContent.reduce((sum, week) => sum + (week.topics?.length || 0), 0),
    });
  } catch (error) {
    log.error('Failed to generate content reminders', error as Error, { userId });
    throw error;
  }
}

/**
 * Generate content reminders for all users
 */
async function generateAllContentReminders(): Promise<void> {
  try {
    log.info('Generating content calendar reminders for all users');

    const users = await prisma.userProfileEnhancement.findMany({
      select: { userId: true },
    });

    log.info(`Generating reminders for ${users.length} users`);

    // Generate reminders in parallel (with concurrency limit)
    const concurrency = 5;
    for (let i = 0; i < users.length; i += concurrency) {
      const batch = users.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(user => generateContentReminders(user.userId))
      );
    }

    log.info('All content calendar reminders generated');
  } catch (error) {
    log.error('Failed to generate all content reminders', error as Error);
    throw error;
  }
}

/**
 * Start the content calendar worker
 */
export function startContentCalendarWorker(): void {
  log.info('Starting content calendar worker');

  // Run daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    log.info('Running scheduled content calendar reminder generation');
    try {
      await generateAllContentReminders();
    } catch (error) {
      log.error('Error in scheduled content calendar reminder generation', error as Error);
    }
  });

  log.info('Content calendar worker started (runs daily at 9 AM)');
}

// Auto-start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startContentCalendarWorker();
  
  // Keep process alive
  process.on('SIGTERM', () => {
    log.info('Content calendar worker shutting down');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log.info('Content calendar worker shutting down');
    process.exit(0);
  });
}



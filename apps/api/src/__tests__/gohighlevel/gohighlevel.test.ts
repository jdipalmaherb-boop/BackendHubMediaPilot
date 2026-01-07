import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { enqueueLeadSync, enqueueBatchLeadSync, cancelLeadSync, getSyncStatus, getUserSyncHistory, retryFailedSync, getGoHighLevelQueueHealth } from '../services/gohighlevel';
import { processGoHighLevelJob, testGoHighLevelConnection } from '../workers/gohighlevelWorker';
import { prisma } from '../lib/prisma';
import { gohighlevelQueue } from '../services/gohighlevel';

// Mock fetch globally
global.fetch = jest.fn();

describe('GoHighLevel Service', () => {
  beforeEach(async () => {
    // Clear database
    await prisma.goHighLevelSync.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.user.deleteMany();
    
    // Clear queue
    await gohighlevelQueue.clean(0, 100);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.goHighLevelSync.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.user.deleteMany();
    await gohighlevelQueue.clean(0, 100);
  });

  describe('enqueueLeadSync', () => {
    it('should enqueue a lead sync job successfully', async () => {
      // Create test user and lead
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
        },
      });

      const leadData = {
        email: 'lead@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        source: 'website',
        tags: ['new-lead'],
        customFields: { company: 'Test Corp' },
        locationId: 'loc123',
      };

      const syncId = await enqueueLeadSync(lead.id, user.id, leadData, 'lead_create');

      expect(syncId).toBeDefined();

      // Check sync record was created
      const syncRecord = await prisma.goHighLevelSync.findUnique({
        where: { id: syncId },
      });

      expect(syncRecord).toBeDefined();
      expect(syncRecord?.leadId).toBe(lead.id);
      expect(syncRecord?.syncType).toBe('lead_create');
      expect(syncRecord?.status).toBe('queued');
      expect(syncRecord?.requestData).toEqual({
        leadId: lead.id,
        userId: user.id,
        leadData,
        syncType: 'lead_create',
        metadata: undefined,
      });

      // Check job was added to queue
      const jobs = await gohighlevelQueue.getJobs(['waiting', 'delayed', 'active']);
      expect(jobs.length).toBeGreaterThan(0);
    });

    it('should prevent duplicate sync jobs', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const leadData = {
        email: 'lead@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      // Enqueue first sync
      const syncId1 = await enqueueLeadSync(lead.id, user.id, leadData, 'lead_create');
      
      // Try to enqueue duplicate
      const syncId2 = await enqueueLeadSync(lead.id, user.id, leadData, 'lead_create');

      // Should return existing sync ID
      expect(syncId1).toBe(syncId2);

      // Should only have one sync record
      const syncRecords = await prisma.goHighLevelSync.findMany({
        where: { leadId: lead.id },
      });
      expect(syncRecords.length).toBe(1);
    });

    it('should handle different sync types', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const leadData = {
        email: 'lead@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const syncTypes = ['lead_create', 'lead_update', 'lead_tag', 'custom_field_update'] as const;

      for (const syncType of syncTypes) {
        const syncId = await enqueueLeadSync(lead.id, user.id, leadData, syncType);
        expect(syncId).toBeDefined();

        const syncRecord = await prisma.goHighLevelSync.findUnique({
          where: { id: syncId },
        });
        expect(syncRecord?.syncType).toBe(syncType);
      }
    });
  });

  describe('enqueueBatchLeadSync', () => {
    it('should enqueue multiple leads successfully', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const leads = [];
      for (let i = 0; i < 3; i++) {
        const lead = await prisma.lead.create({
          data: {
            userId: user.id,
            email: `lead${i}@example.com`,
            firstName: `Lead${i}`,
            lastName: 'Doe',
          },
        });
        leads.push(lead);
      }

      const batchData = leads.map(lead => ({
        leadId: lead.id,
        userId: user.id,
        leadData: {
          email: lead.email,
          firstName: lead.firstName,
          lastName: lead.lastName,
        },
        syncType: 'lead_create' as const,
      }));

      const syncIds = await enqueueBatchLeadSync(batchData);

      expect(syncIds.length).toBe(3);
      expect(syncIds.every(id => id !== null)).toBe(true);

      // Check all sync records were created
      const syncRecords = await prisma.goHighLevelSync.findMany({
        where: { leadId: { in: leads.map(l => l.id) } },
      });
      expect(syncRecords.length).toBe(3);
    });

    it('should handle partial failures gracefully', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const batchData = [
        {
          leadId: lead.id,
          userId: user.id,
          leadData: {
            email: 'lead@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
          syncType: 'lead_create' as const,
        },
        {
          leadId: 'invalid-lead-id',
          userId: user.id,
          leadData: {
            email: 'invalid@example.com',
            firstName: 'Invalid',
            lastName: 'Lead',
          },
          syncType: 'lead_create' as const,
        },
      ];

      const syncIds = await enqueueBatchLeadSync(batchData);

      // Should have one successful sync
      expect(syncIds.length).toBe(1);
      expect(syncIds[0]).toBeDefined();
    });
  });

  describe('cancelLeadSync', () => {
    it('should cancel a queued sync successfully', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const leadData = {
        email: 'lead@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const syncId = await enqueueLeadSync(lead.id, user.id, leadData, 'lead_create');
      const cancelled = await cancelLeadSync(syncId);

      expect(cancelled).toBe(true);

      const syncRecord = await prisma.goHighLevelSync.findUnique({
        where: { id: syncId },
      });
      expect(syncRecord?.status).toBe('cancelled');
    });

    it('should not cancel already synced records', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      // Create a completed sync record
      const syncRecord = await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_create',
          status: 'synced',
          externalId: 'ext123',
          requestData: { leadId: lead.id, userId: user.id, leadData: {}, syncType: 'lead_create' },
        },
      });

      const cancelled = await cancelLeadSync(syncRecord.id);
      expect(cancelled).toBe(false);

      const updatedRecord = await prisma.goHighLevelSync.findUnique({
        where: { id: syncRecord.id },
      });
      expect(updatedRecord?.status).toBe('synced');
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status with job information', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const leadData = {
        email: 'lead@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const syncId = await enqueueLeadSync(lead.id, user.id, leadData, 'lead_create');
      const status = await getSyncStatus(syncId);

      expect(status).toBeDefined();
      expect(status.id).toBe(syncId);
      expect(status.leadId).toBe(lead.id);
      expect(status.syncType).toBe('lead_create');
      expect(status.status).toBe('queued');
      expect(status.lead).toBeDefined();
      expect(status.lead.email).toBe('lead@example.com');
    });

    it('should return null for non-existent sync', async () => {
      const status = await getSyncStatus('non-existent-id');
      expect(status).toBeNull();
    });
  });

  describe('getUserSyncHistory', () => {
    it('should return paginated sync history', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const leads = [];
      for (let i = 0; i < 5; i++) {
        const lead = await prisma.lead.create({
          data: {
            userId: user.id,
            email: `lead${i}@example.com`,
            firstName: `Lead${i}`,
            lastName: 'Doe',
          },
        });
        leads.push(lead);
      }

      // Create sync records
      for (const lead of leads) {
        await prisma.goHighLevelSync.create({
          data: {
            leadId: lead.id,
            syncType: 'lead_create',
            status: 'synced',
            externalId: `ext${lead.id}`,
            requestData: { leadId: lead.id, userId: user.id, leadData: {}, syncType: 'lead_create' },
          },
        });
      }

      const history = await getUserSyncHistory(user.id, 1, 3);

      expect(history.syncRecords.length).toBe(3);
      expect(history.pagination.total).toBe(5);
      expect(history.pagination.pages).toBe(2);
      expect(history.pagination.page).toBe(1);
      expect(history.pagination.limit).toBe(3);
    });

    it('should filter by status', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      // Create different status syncs
      await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_create',
          status: 'synced',
          externalId: 'ext1',
          requestData: { leadId: lead.id, userId: user.id, leadData: {}, syncType: 'lead_create' },
        },
      });

      await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_update',
          status: 'failed',
          error: 'Test error',
          requestData: { leadId: lead.id, userId: user.id, leadData: {}, syncType: 'lead_update' },
        },
      });

      const syncedHistory = await getUserSyncHistory(user.id, 1, 10, 'synced');
      expect(syncedHistory.syncRecords.length).toBe(1);
      expect(syncedHistory.syncRecords[0].status).toBe('synced');

      const failedHistory = await getUserSyncHistory(user.id, 1, 10, 'failed');
      expect(failedHistory.syncRecords.length).toBe(1);
      expect(failedHistory.syncRecords[0].status).toBe('failed');
    });
  });

  describe('retryFailedSync', () => {
    it('should retry a failed sync successfully', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      // Create a failed sync record
      const syncRecord = await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_create',
          status: 'failed',
          error: 'Test error',
          requestData: { 
            leadId: lead.id, 
            userId: user.id, 
            leadData: { email: 'lead@example.com' }, 
            syncType: 'lead_create' 
          },
        },
      });

      const retried = await retryFailedSync(syncRecord.id);
      expect(retried).toBe(true);

      const updatedRecord = await prisma.goHighLevelSync.findUnique({
        where: { id: syncRecord.id },
      });
      expect(updatedRecord?.status).toBe('queued');
      expect(updatedRecord?.error).toBeNull();
    });

    it('should not retry already synced records', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const syncRecord = await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_create',
          status: 'synced',
          externalId: 'ext123',
          requestData: { leadId: lead.id, userId: user.id, leadData: {}, syncType: 'lead_create' },
        },
      });

      const retried = await retryFailedSync(syncRecord.id);
      expect(retried).toBe(false);

      const updatedRecord = await prisma.goHighLevelSync.findUnique({
        where: { id: syncRecord.id },
      });
      expect(updatedRecord?.status).toBe('synced');
    });
  });

  describe('getGoHighLevelQueueHealth', () => {
    it('should return queue health information', async () => {
      const health = await getGoHighLevelQueueHealth();

      expect(health).toBeDefined();
      expect(health.queue).toBe('gohighlevel');
      expect(health.counts).toBeDefined();
      expect(health.counts.waiting).toBeDefined();
      expect(health.counts.active).toBeDefined();
      expect(health.counts.completed).toBeDefined();
      expect(health.counts.failed).toBeDefined();
      expect(health.counts.delayed).toBeDefined();
      expect(health.isHealthy).toBeDefined();
    });
  });
});

describe('GoHighLevel Worker', () => {
  beforeEach(async () => {
    await prisma.goHighLevelSync.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.user.deleteMany();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.goHighLevelSync.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('processGoHighLevelJob', () => {
    it('should process lead_create job successfully', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      // Create sync record
      const syncRecord = await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_create',
          status: 'queued',
          requestData: {
            leadId: lead.id,
            userId: user.id,
            leadData: {
              email: 'lead@example.com',
              firstName: 'John',
              lastName: 'Doe',
            },
            syncType: 'lead_create',
          },
        },
      });

      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          contact: {
            id: 'ghl_contact_123',
            email: 'lead@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        }),
      });

      const jobPayload = {
        leadId: lead.id,
        userId: user.id,
        leadData: {
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        syncType: 'lead_create' as const,
      };

      const mockJob = {
        id: 'job_123',
        data: jobPayload,
        attemptsMade: 0,
      } as any;

      const result = await processGoHighLevelJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.status).toBe('synced');
      expect(result.externalId).toBe('ghl_contact_123');

      // Check sync record was updated
      const updatedSync = await prisma.goHighLevelSync.findUnique({
        where: { id: syncRecord.id },
      });
      expect(updatedSync?.status).toBe('synced');
      expect(updatedSync?.externalId).toBe('ghl_contact_123');
    });

    it('should handle API errors gracefully', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const syncRecord = await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_create',
          status: 'queued',
          requestData: {
            leadId: lead.id,
            userId: user.id,
            leadData: {
              email: 'lead@example.com',
              firstName: 'John',
              lastName: 'Doe',
            },
            syncType: 'lead_create',
          },
        },
      });

      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Invalid email format',
        }),
      });

      const jobPayload = {
        leadId: lead.id,
        userId: user.id,
        leadData: {
          email: 'invalid-email',
          firstName: 'John',
          lastName: 'Doe',
        },
        syncType: 'lead_create' as const,
      };

      const mockJob = {
        id: 'job_123',
        data: jobPayload,
        attemptsMade: 0,
      } as any;

      await expect(processGoHighLevelJob(mockJob)).rejects.toThrow();

      // Check sync record was updated with error
      const updatedSync = await prisma.goHighLevelSync.findUnique({
        where: { id: syncRecord.id },
      });
      expect(updatedSync?.status).toBe('failed');
      expect(updatedSync?.error).toBeDefined();
    });

    it('should handle rate limiting with retry after', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const syncRecord = await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_create',
          status: 'queued',
          requestData: {
            leadId: lead.id,
            userId: user.id,
            leadData: {
              email: 'lead@example.com',
              firstName: 'John',
              lastName: 'Doe',
            },
            syncType: 'lead_create',
          },
        },
      });

      // Mock rate limit response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => name === 'Retry-After' ? '60' : null,
        },
        json: async () => ({
          message: 'Rate limit exceeded',
        }),
      });

      const jobPayload = {
        leadId: lead.id,
        userId: user.id,
        leadData: {
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        syncType: 'lead_create' as const,
      };

      const mockJob = {
        id: 'job_123',
        data: jobPayload,
        attemptsMade: 0,
      } as any;

      await expect(processGoHighLevelJob(mockJob)).rejects.toThrow('Rate limited: retry after 60s');

      // Check sync record was updated
      const updatedSync = await prisma.goHighLevelSync.findUnique({
        where: { id: syncRecord.id },
      });
      expect(updatedSync?.status).toBe('failed');
      expect(updatedSync?.meta?.retryAfter).toBe(60);
    });

    it('should handle duplicate external IDs', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          userId: user.id,
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      // Create existing sync with external ID
      await prisma.goHighLevelSync.create({
        data: {
          leadId: 'other-lead-id',
          syncType: 'lead_create',
          status: 'synced',
          externalId: 'ghl_contact_123',
          requestData: { leadId: 'other-lead-id', userId: user.id, leadData: {}, syncType: 'lead_create' },
        },
      });

      const syncRecord = await prisma.goHighLevelSync.create({
        data: {
          leadId: lead.id,
          syncType: 'lead_create',
          status: 'queued',
          requestData: {
            leadId: lead.id,
            userId: user.id,
            leadData: {
              email: 'lead@example.com',
              firstName: 'John',
              lastName: 'Doe',
            },
            syncType: 'lead_create',
          },
        },
      });

      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          contact: {
            id: 'ghl_contact_123', // Same ID as existing
            email: 'lead@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        }),
      });

      const jobPayload = {
        leadId: lead.id,
        userId: user.id,
        leadData: {
          email: 'lead@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        syncType: 'lead_create' as const,
      };

      const mockJob = {
        id: 'job_123',
        data: jobPayload,
        attemptsMade: 0,
      } as any;

      const result = await processGoHighLevelJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.status).toBe('duplicate');
      expect(result.externalId).toBe('ghl_contact_123');

      // Check sync record was updated
      const updatedSync = await prisma.goHighLevelSync.findUnique({
        where: { id: syncRecord.id },
      });
      expect(updatedSync?.status).toBe('duplicate');
      expect(updatedSync?.externalId).toBe('ghl_contact_123');
    });
  });

  describe('testGoHighLevelConnection', () => {
    it('should test API connection successfully', async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          contact: {
            id: 'test_contact_123',
            email: 'test@example.com',
          },
        }),
      });

      const result = await testGoHighLevelConnection();
      expect(result.success).toBe(true);
    });

    it('should handle API connection errors', async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Unauthorized',
        }),
      });

      const result = await testGoHighLevelConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await testGoHighLevelConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});

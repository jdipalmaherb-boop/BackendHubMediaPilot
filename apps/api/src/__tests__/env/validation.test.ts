import { z } from 'zod';

describe('Environment Variable Validation Tests', () => {
  // Save original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('S3 Credentials Validation', () => {
    it('should require S3 credentials in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
      // Missing S3 credentials

      // Dynamically import env module to trigger validation
      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).toThrow(/S3 credentials/);
    });

    it('should accept AWS credentials in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
      process.env.AWS_ACCESS_KEY_ID = 'AKIA...';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).not.toThrow();
    });

    it('should accept S3 credentials in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
      process.env.S3_ACCESS_KEY = 'S3KEY123';
      process.env.S3_SECRET_KEY = 'S3SECRET123';

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).not.toThrow();
    });

    it('should allow missing S3 credentials in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
      // No S3 credentials required in development

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).not.toThrow();
    });

    it('should allow missing S3 credentials in test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
      // No S3 credentials required in test

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).not.toThrow();
    });
  });

  describe('Required Environment Variables', () => {
    it('should require DATABASE_URL', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.DATABASE_URL;

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).toThrow();
    });

    it('should require JWT_SECRET with minimum length', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'short'; // Too short
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).toThrow(/JWT_SECRET/);
    });

    it('should require JWT_REFRESH_SECRET with minimum length', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'short'; // Too short
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('should require S3_BUCKET', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      delete process.env.S3_BUCKET;
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).toThrow(/S3_BUCKET/);
    });

    it('should require OPENAI_API_KEY', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      delete process.env.OPENAI_API_KEY;
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).toThrow(/OPENAI_API_KEY/);
    });

    it('should require STRIPE_SECRET_KEY', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      delete process.env.STRIPE_SECRET_KEY;
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).toThrow(/STRIPE_SECRET_KEY/);
    });

    it('should require STRIPE_WEBHOOK_SECRET', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      delete process.env.STRIPE_WEBHOOK_SECRET;

      expect(() => {
        jest.isolateModules(() => {
          require('../../env');
        });
      }).toThrow(/STRIPE_WEBHOOK_SECRET/);
    });
  });

  describe('Default Values', () => {
    it('should use default values for optional variables', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'super-secure-jwt-secret-32-chars-minimum-length';
      process.env.JWT_REFRESH_SECRET = 'super-secure-refresh-secret-32-chars-minimum';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.GOHIGHLEVEL_API_KEY = 'ghl-test-key';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
      // Don't set optional variables

      let env: any;
      expect(() => {
        jest.isolateModules(() => {
          env = require('../../env').env;
        });
      }).not.toThrow();

      // Should have default values
      expect(env.PORT).toBe(4000);
      expect(env.S3_REGION).toBe('us-east-1');
      expect(env.MAX_UPLOAD_SIZE).toBe(100 * 1024 * 1024);
      expect(env.S3_PRESIGN_EXPIRE).toBe(3600);
      expect(env.LOG_LEVEL).toBe('info');
    });
  });
});


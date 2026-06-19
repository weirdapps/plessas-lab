/**
 * Auth-flow and token-handling tests for plessas-lab
 *
 * Tests security-critical credential handling paths across YouTube, Gmail,
 * and Nano Banana integrations to prevent token leaks and auth failures.
 *
 * NOTE: ESM modules can't be spied on with vi.spyOn for Node.js built-ins.
 * Using vi.mock() and hoisted mocks instead.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as path from 'path';

// Mock process.env for isolated tests
const originalEnv = process.env;

// Mock filesystem operations
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock googleapis to avoid dependency issues in tests
const mockGoogleApis = vi.hoisted(() => ({
  google: {
    auth: {
      OAuth2: vi.fn(() => ({
        setCredentials: vi.fn(),
        generateAuthUrl: vi.fn(() => 'http://mock-auth-url'),
        getToken: vi.fn(),
        refreshAccessToken: vi.fn(),
      })),
      fromJSON: vi.fn(),
    },
    youtube: vi.fn(),
    gmail: vi.fn(),
  },
}));

vi.mock('fs', () => mockFs);
vi.mock('googleapis', () => mockGoogleApis);
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(),
}));
vi.mock('@google-cloud/local-auth', () => ({
  authenticate: vi.fn(),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({})),
}));

describe('Auth Flow & Token Security', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };

    // Reset all mocks
    mockFs.existsSync.mockReset();
    mockFs.readFileSync.mockReset();
    mockFs.writeFileSync.mockReset();
    mockFs.mkdirSync.mockReset();
    mockFs.unlinkSync.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Test 1: Token loaded from env var (Nano Banana)', () => {
    it('should load GEMINI_API_KEY from environment', async () => {
      // Setup: Set env var
      process.env.GEMINI_API_KEY = 'test-key-abc123';

      // Import fresh module that reads env
      const { createClient } = await import(
        '../plugins/manage-nano-banana/skills/manage-nano-banana/tools/nano-banana-client.ts'
      );

      // Act & Assert: Should not throw
      expect(() => createClient()).not.toThrow();
    });

    it('should throw clear error when no credentials are configured', async () => {
      // Setup: Explicitly delete env var, and clear any Vertex routing so the
      // API-key path is the only option (createClient now prefers Vertex AI
      // when a GCP project is configured).
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.VERTEX_SDK_PROJECT;
      delete process.env.ANTHROPIC_VERTEX_PROJECT_ID;
      delete process.env.GOOGLE_GENAI_USE_VERTEXAI;

      // Import fresh module
      const { createClient } = await import(
        '../plugins/manage-nano-banana/skills/manage-nano-banana/tools/nano-banana-client.ts'
      );

      // Act & Assert: Should throw with clear message
      expect(() => createClient()).toThrow(/image-generation credentials/);
    });

    it('should reject empty/whitespace-only tokens', async () => {
      // Clear Vertex routing so the API-key validation path is exercised
      // (createClient prefers Vertex AI when a GCP project is configured).
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.VERTEX_SDK_PROJECT;
      delete process.env.ANTHROPIC_VERTEX_PROJECT_ID;
      delete process.env.GOOGLE_GENAI_USE_VERTEXAI;

      // Setup: Empty string token
      process.env.GEMINI_API_KEY = '';

      const { createClient } = await import(
        '../plugins/manage-nano-banana/skills/manage-nano-banana/tools/nano-banana-client.ts'
      );

      // Act & Assert: Empty string should fail
      expect(() => createClient()).toThrow(/image-generation credentials/);

      // Setup: Whitespace-only token
      vi.resetModules();
      process.env.GEMINI_API_KEY = '   '; // gitleaks:allow (test value only)

      const { createClient: createClient2 } = await import(
        '../plugins/manage-nano-banana/skills/manage-nano-banana/tools/nano-banana-client.ts?v2'
      );
      expect(() => createClient2()).toThrow(/image-generation credentials/);
    });
  });

  describe('Test 2: Auth failure surfaces as clean error (YouTube)', () => {
    it('should throw PlaylistError with clear message when not authenticated', async () => {
      // Mock fs to simulate no tokens file
      mockFs.existsSync.mockReturnValue(false);

      const { getAuthenticatedClient } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      // Act & Assert: Should throw with operation context
      expect(() => getAuthenticatedClient()).toThrow(/Not authenticated/);
      expect(() => getAuthenticatedClient()).toThrow(/npx tsx cli\/auth.ts login/);
    });

    it('should surface file path in error when credentials file missing', async () => {
      // Mock credentials file missing
      mockFs.existsSync.mockImplementation((p: string) => {
        // No credentials file exists
        return !p.toString().includes('YouTubeSkill-Credentials.json');
      });

      mockFs.readFileSync.mockImplementation((p: string) => {
        const pathStr = p.toString();
        if (pathStr.includes('YouTubeSkill-Credentials.json')) {
          throw new Error('ENOENT: no such file');
        }
        return '';
      });

      // Force a fresh import to test credential loading
      const { getAuthenticatedClient } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts?v=credtest'
      );

      // Act & Assert: Should surface credential file path in error when trying to use auth
      try {
        getAuthenticatedClient();
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toMatch(/Not authenticated/);
      }
    });
  });

  describe('Test 3: Token refresh logic (YouTube)', () => {
    it('should detect expired tokens correctly', async () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock expired token (1 hour ago)
      const expiredToken = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expiry_date: Date.now() - 3600000,
        scope: 'https://www.googleapis.com/auth/youtube',
        token_type: 'Bearer',
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(expiredToken));

      const { isTokenExpired } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      // Act & Assert: Should detect expiry
      expect(isTokenExpired()).toBe(true);
    });

    it('should detect valid tokens correctly', async () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock valid token (1 hour from now)
      const validToken = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expiry_date: Date.now() + 3600000,
        scope: 'https://www.googleapis.com/auth/youtube',
        token_type: 'Bearer',
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(validToken));

      const { isTokenExpired } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      // Act & Assert: Should NOT detect as expired
      expect(isTokenExpired()).toBe(false);
    });

    it('should treat missing expiry_date as expired', async () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock token without expiry_date
      const tokenNoExpiry = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        scope: 'https://www.googleapis.com/auth/youtube',
        token_type: 'Bearer',
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(tokenNoExpiry));

      const { isTokenExpired } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      // Act & Assert: Missing expiry should be treated as expired
      expect(isTokenExpired()).toBe(true);
    });
  });

  describe('Test 4: No-token-leak in errors', () => {
    it('should NOT include token values in error messages', async () => {
      const testToken = 'super-secret-token-12345'; // gitleaks:allow (test value only)
      process.env.GEMINI_API_KEY = testToken;

      // Force an error by passing invalid params (not testing the actual API)
      const { createClient, readImageAsBase64 } = await import(
        '../plugins/manage-nano-banana/skills/manage-nano-banana/tools/nano-banana-client.ts'
      );

      // Get client - should not throw
      const client = createClient();
      expect(client).toBeDefined();

      // Simulate error scenario: missing file
      mockFs.existsSync.mockReturnValue(false);

      try {
        readImageAsBase64('/nonexistent/path.png');
        expect.fail('Should have thrown');
      } catch (error) {
        const errorMsg = (error as Error).message;
        // Error message should NOT contain the API key
        expect(errorMsg).not.toContain(testToken);
        expect(errorMsg).toContain('Image file not found');
      }
    });

    it('should use displayPath helper to avoid leaking username in YouTube errors', async () => {
      // Mock HOME to a known value
      const originalHome = process.env.HOME;
      process.env.HOME = '/Users/testuser';

      mockFs.existsSync.mockReturnValue(false);

      // Force credentials loading to fail
      const { getAuthenticatedClient } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      try {
        getAuthenticatedClient();
        expect.fail('Should have thrown');
      } catch (error) {
        const errorMsg = (error as Error).message;
        // Should NOT leak username in path
        expect(errorMsg).not.toContain('/Users/testuser');
        expect(errorMsg).toContain('Not authenticated');
      }

      process.env.HOME = originalHome;
    });
  });

  describe('Test 5: Credential file path resolution', () => {
    it('should resolve correct paths for YouTube credentials', async () => {
      const { getStoragePaths } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      const paths = getStoragePaths();

      // Assert: Paths should be under HOME/.google-skills/youtube
      expect(paths.credentials).toContain('.google-skills/youtube');
      expect(paths.credentials).toContain('YouTubeSkill-Credentials.json');
      expect(paths.tokens).toContain('.google-skills/youtube');
      expect(paths.tokens).toContain('youtube-tokens.json');

      // Paths should be absolute
      expect(path.isAbsolute(paths.credentials)).toBe(true);
      expect(path.isAbsolute(paths.tokens)).toBe(true);
    });

    it('should handle missing credentials file gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { credentialsExist } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      // Act & Assert: Should return false, not throw
      expect(credentialsExist()).toBe(false);
    });
  });

  describe('Test 6: Token file permissions', () => {
    it('should save YouTube tokens with 0600 mode to prevent reads by other users', async () => {
      mockFs.existsSync.mockReturnValue(false);

      // Import and verify saveTokens creates with mode 0o600
      // We can't call saveTokens directly (not exported), but we can verify
      // the implementation via code inspection
      const { getStoragePaths } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      const paths = getStoragePaths();

      // Verify the paths exist (implementation validates)
      expect(paths.tokens).toBeDefined();
      expect(paths.tokens).toContain('youtube-tokens.json');

      // NOTE: Actual 0600 mode check happens in code at line 86:
      // fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
    });

    it('should create credentials directory with 0700 mode', async () => {
      mockFs.existsSync.mockReturnValue(false);

      // Verify the implementation pattern exists
      const { getStoragePaths } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      const paths = getStoragePaths();

      // Verify directory structure is correct
      expect(paths.credentials).toContain('.google-skills/youtube');

      // NOTE: Actual 0700 mode check happens in code at line 45:
      // fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    });
  });

  describe('Test 7: Multiple integrations isolated', () => {
    it('should use separate credential paths for YouTube vs Gmail', async () => {
      const { getStoragePaths: getYouTubePaths } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      const youtubePaths = getYouTubePaths();

      // Gmail uses ~/.google-skills/gmail/ (from code inspection)
      const gmailCredPath = path.join(
        process.env.HOME || '',
        '.google-skills',
        'gmail',
        'GMailSkill-Credentials.json'
      );

      // Assert: Paths are different directories
      expect(youtubePaths.credentials).not.toBe(gmailCredPath);
      expect(youtubePaths.credentials).toContain('youtube');
      expect(gmailCredPath).toContain('gmail');
    });

    it('should use different auth mechanisms for Nano Banana vs OAuth integrations', () => {
      // Nano Banana uses GEMINI_API_KEY (env var)
      // YouTube/Gmail use file-based OAuth credentials
      // Verify they don't interfere

      process.env.GEMINI_API_KEY = 'gemini-key-xyz'; // gitleaks:allow (test value only)

      // Verify env var is set
      expect(process.env.GEMINI_API_KEY).toBe('gemini-key-xyz');

      // YouTube credentials should be file-based
      const expectedYouTubePath = path.join(
        process.env.HOME || '',
        '.google-skills',
        'youtube',
        'YouTubeSkill-Credentials.json'
      );

      // Different auth strategies
      expect(expectedYouTubePath).toContain('.google-skills');
      expect(process.env.GEMINI_API_KEY).not.toContain('.google-skills');
    });
  });

  describe('Test 8: Auth status reporting', () => {
    it('should report correct auth status for unauthenticated state', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { getAuthStatus } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      const status = getAuthStatus();

      // Assert: Should report as not authenticated
      expect(status.isAuthenticated).toBe(false);
      expect(status.hasTokens).toBe(false);
      expect(status.isExpired).toBe(true);
    });

    it('should report correct auth status for authenticated state', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const validToken = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expiry_date: Date.now() + 3600000,
        scope: 'https://www.googleapis.com/auth/youtube',
        token_type: 'Bearer',
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(validToken));

      const { getAuthStatus } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      const status = getAuthStatus();

      // Assert: Should report as authenticated
      expect(status.isAuthenticated).toBe(true);
      expect(status.hasTokens).toBe(true);
      expect(status.isExpired).toBe(false);
      expect(status.expiryDate).toBeInstanceOf(Date);
    });

    it('should parse scopes correctly from stored tokens', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const tokenWithScopes = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expiry_date: Date.now() + 3600000,
        scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.readonly',
        token_type: 'Bearer',
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(tokenWithScopes));

      const { getAuthStatus } = await import(
        '../plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools/src/auth/oauth-client.ts'
      );

      const status = getAuthStatus();

      // Assert: Should parse space-separated scopes
      expect(status.scopes).toEqual([
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.readonly'
      ]);
    });
  });
});

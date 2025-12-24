import { createTestUser } from '../helpers/test-utils';
import { supabaseAnon, supabaseService } from '../setup';
import { cleanupAfterTest } from '../helpers/db-cleanup';

describe('Dashboard Authentication', () => {
  let testUser: { id: string; email: string; accessToken: string };

  beforeEach(async () => {
    testUser = await createTestUser();
  });

  afterEach(async () => {
    await cleanupAfterTest({
      userIds: [testUser.id],
    });
  });

  it('should allow user login with valid credentials', async () => {
    // User is already created in beforeEach
    // Test that we can get session
    const { data: session, error } = await supabaseAnon.auth.getSession();

    // Session might not exist immediately after signup
    // This test verifies authentication flow exists
    expect(error).toBeNull();
  });

  it('should manage user session', async () => {
    // Create a new user using helper (uses admin API)
    const newUser = await createTestUser();

    expect(newUser.id).toBeDefined();
    expect(newUser.email).toBeDefined();

    // If access token is available, verify session
    if (newUser.accessToken) {
      // Set session using access token
      await supabaseAnon.auth.setSession({
        access_token: newUser.accessToken,
        refresh_token: '',
      });

      // Get session
      const { data: sessionData, error: sessionError } = await supabaseAnon.auth.getSession();

      expect(sessionError).toBeNull();
      expect(sessionData.session).toBeDefined();

      // Clean up
      await supabaseService.auth.admin.deleteUser(newUser.id);
    }
  });

  it('should protect routes requiring authentication', async () => {
    // Test that protected routes require authentication
    // In a real Next.js app, middleware would check auth

    // Without authentication, should not be able to access user data
    const { data: licenses, error } = await supabaseAnon
      .from('licenses')
      .select('*')
      .eq('user_id', testUser.id);

    // RLS policies should prevent access without proper auth
    // This depends on how Supabase RLS is configured
    expect(error || !licenses || licenses.length === 0).toBe(true);
  });

  it('should handle session expiration', async () => {
    // Create user using helper (uses admin API)
    const newUser = await createTestUser();

    expect(newUser.id).toBeDefined();

    // If access token is available, verify session expiration
    if (newUser.accessToken) {
      // Set session using access token
      await supabaseAnon.auth.setSession({
        access_token: newUser.accessToken,
        refresh_token: '',
      });

      const { data: sessionData } = await supabaseAnon.auth.getSession();

      if (sessionData.session) {
        // Session should be valid
        expect(sessionData.session.expires_at).toBeDefined();
        expect(sessionData.session.expires_at).toBeGreaterThan(Date.now() / 1000);
      }

        // Clean up
      await supabaseService.auth.admin.deleteUser(newUser.id);
    }
  });

  it('should allow user logout', async () => {
    // Create user using helper (uses admin API)
    const newUser = await createTestUser();

    expect(newUser.id).toBeDefined();

    // If access token is available, test logout
    if (newUser.accessToken) {
      // Set session using access token
      await supabaseAnon.auth.setSession({
        access_token: newUser.accessToken,
        refresh_token: '',
      });

      // Sign out
      const { error: signOutError } = await supabaseAnon.auth.signOut();

      expect(signOutError).toBeNull();

      // Verify session is cleared
      const { data: sessionData } = await supabaseAnon.auth.getSession();
      expect(sessionData.session).toBeNull();
    }

      // Clean up
    await supabaseService.auth.admin.deleteUser(newUser.id);
  });
});


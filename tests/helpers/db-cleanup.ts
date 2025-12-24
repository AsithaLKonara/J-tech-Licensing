import { supabaseService, testDataCleanup } from '../setup';

/**
 * Clean up test data in reverse dependency order
 */
export async function cleanupTestData(): Promise<void> {
  console.log('Cleaning up test data...');

  // 1. Clean up revoked_licenses
  if (testDataCleanup.licenseIds.length > 0) {
    const { error: revokedError } = await supabaseService
      .from('revoked_licenses')
      .delete()
      .in('license_id', testDataCleanup.licenseIds);

    if (revokedError) {
      console.warn('Error cleaning up revoked_licenses:', revokedError);
    }
  }

  // 2. Clean up licenses
  if (testDataCleanup.licenseIds.length > 0) {
    const { error: licenseError } = await supabaseService
      .from('licenses')
      .delete()
      .in('id', testDataCleanup.licenseIds);

    if (licenseError) {
      console.warn('Error cleaning up licenses:', licenseError);
    }
  }

  // 3. Clean up devices
  if (testDataCleanup.deviceIds.length > 0) {
    const { error: deviceError } = await supabaseService
      .from('devices')
      .delete()
      .in('id', testDataCleanup.deviceIds);

    if (deviceError) {
      console.warn('Error cleaning up devices:', deviceError);
    }
  }

  // 4. Clean up audit_logs
  if (testDataCleanup.userIds.length > 0 || testDataCleanup.licenseIds.length > 0) {
    // Clean up by user_id
    if (testDataCleanup.userIds.length > 0) {
      const { error: auditError } = await supabaseService
        .from('audit_logs')
        .delete()
        .in('user_id', testDataCleanup.userIds);

      if (auditError) {
        console.warn('Error cleaning up audit_logs by user_id:', auditError);
      }
    }

    // Clean up by entity_id (license_id)
    if (testDataCleanup.licenseIds.length > 0) {
      const { error: auditError } = await supabaseService
        .from('audit_logs')
        .delete()
        .in('entity_id', testDataCleanup.licenseIds);

      if (auditError) {
        console.warn('Error cleaning up audit_logs by entity_id:', auditError);
      }
    }
  }

  // 5. Clean up users (via auth admin API)
  for (const userId of testDataCleanup.userIds) {
    try {
      await supabaseService.auth.admin.deleteUser(userId);
    } catch (error) {
      console.warn(`Failed to delete user ${userId}:`, error);
    }
  }

  // Reset tracking arrays
  testDataCleanup.userIds = [];
  testDataCleanup.licenseIds = [];
  testDataCleanup.deviceIds = [];
}

/**
 * Clean up data created during a specific test
 */
export async function cleanupAfterTest(testData: {
  userIds?: string[];
  licenseIds?: string[];
  deviceIds?: string[];
}): Promise<void> {
  const { userIds = [], licenseIds = [], deviceIds = [] } = testData;

  // Clean up in reverse dependency order
  if (licenseIds.length > 0) {
    await supabaseService.from('revoked_licenses').delete().in('license_id', licenseIds);
    await supabaseService.from('licenses').delete().in('id', licenseIds);
  }

  if (deviceIds.length > 0) {
    await supabaseService.from('devices').delete().in('id', deviceIds);
  }

  if (userIds.length > 0) {
    await supabaseService.from('audit_logs').delete().in('user_id', userIds);
    for (const userId of userIds) {
      try {
        await supabaseService.auth.admin.deleteUser(userId);
      } catch (error) {
        console.warn(`Failed to delete user ${userId}:`, error);
      }
    }
  }
}


# License System Test Suite

This directory contains comprehensive automated tests for the license system.

## Test Structure

- **edge-functions/**: Tests for all Supabase Edge Functions
- **database/**: Database schema, RLS policies, and migration tests
- **e2e/**: End-to-end flow tests
- **desktop-client/**: Desktop client simulation tests
- **dashboard/**: Dashboard integration tests
- **security/**: Security and authorization tests
- **helpers/**: Test utilities and helper functions

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export LICENSE_SIGNING_PRIVATE_KEY_JWK="your-private-key-jwk"
export LICENSE_SIGNING_PUBLIC_KEY_JWK="your-public-key-jwk"
```

Or create a `.env.test` file in the `apps/license-system/` directory.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:edge-functions
npm run test:e2e
npm run test:database
npm run test:desktop-client
npm run test:dashboard
npm run test:security
```

## Test Coverage

The test suite aims for:
- Edge Functions: 100% coverage
- Database operations: 100% coverage
- Critical paths: 100% coverage
- Error handling: 90%+ coverage
- Edge cases: 85%+ coverage

## Database Cleanup

Tests automatically clean up test data after each test run. The cleanup mechanism:
- Tags test data with unique test run IDs
- Cleans up in reverse dependency order
- Uses Supabase service role key for cleanup operations
- Removes: revoked_licenses → licenses → devices → users → audit_logs

## Notes

- Tests use the online Supabase database (not local)
- All test data is automatically cleaned up
- Tests are designed to be idempotent and can be run multiple times
- Edge Function tests require deployed Edge Functions to be accessible


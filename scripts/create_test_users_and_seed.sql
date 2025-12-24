-- Complete Setup Script: Create Test Users and Seed Data
-- This script creates test users via Supabase Auth Admin API (requires service role)
-- Then seeds sample data for those users

-- IMPORTANT: This requires Supabase service_role key and should be run via API or Admin dashboard
-- You cannot run auth.admin.createUser via SQL - use the Supabase Management API or Dashboard

-- Part 1: Create Test Users (must be done via API/Admin, not SQL)
-- Use Supabase Dashboard > Authentication > Users > Add User
-- Or use the Supabase Management API

-- Example using curl (replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY):
/*
curl -X POST 'https://api.supabase.com/v1/projects/YOUR_PROJECT_REF/auth/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_user_1@example.com",
    "password": "TestPassword123!",
    "email_confirm": true
  }'

curl -X POST 'https://api.supabase.com/v1/projects/YOUR_PROJECT_REF/auth/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_user_2@example.com",
    "password": "TestPassword123!",
    "email_confirm": true
  }'

curl -X POST 'https://api.supabase.com/v1/projects/YOUR_PROJECT_REF/auth/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_user_3@example.com",
    "password": "TestPassword123!",
    "email_confirm": true
  }'
*/

-- Part 2: Seed Data (run this SQL after creating users)
-- This will automatically use the first 3 users from auth.users

-- Run the seed migration
-- The 0004_seed_sample_data.sql migration will handle this automatically
-- Just make sure you've created at least one test user first

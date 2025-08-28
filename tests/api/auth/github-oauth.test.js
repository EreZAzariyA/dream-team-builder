import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import { User } from '../../../lib/database/models/index.js';
import { app } from '../../../app/api/auth/[...nextauth]/route.js'; // Assuming app is exported for testing

// Mock the Mongoose connection to prevent multiple connections
jest.mock('../../../lib/database/mongodb.js', () => ({
  connectMongoose: jest.fn().mockResolvedValue(true),
  disconnectMongoose: jest.fn().mockResolvedValue(true),
}));


describe('GitHub OAuth Integration', () => {
  it('should handle GitHub OAuth callback and create/update user', async () => {
    // Mock the NextAuth.js signIn callback behavior for GitHub
    // This is a simplified mock, in a real scenario you'd mock the actual OAuth flow
    const mockGitHubProfile = {
      id: 'github-user-123',
      email: 'github.test@example.com',
      name: 'GitHub Test User',
      image: 'https://avatars.githubusercontent.com/u/github-user-123?v=4',
    };
    const mockGitHubAccount = {
      provider: 'github',
      type: 'oauth',
      providerAccountId: 'github-user-123',
      access_token: 'mock-github-access-token',
    };

    // Simulate a successful GitHub OAuth callback
    // This is tricky with NextAuth.js as it handles the redirect internally.
    // For API testing, we'd typically mock the NextAuth.js internal functions
    // or test the /api/auth/callback/github route directly if it were exposed.
    // Given the current structure, we'll focus on the user creation/update logic
    // that would happen within the NextAuth.js callbacks.

    // For now, we'll test the underlying user model logic that NextAuth.js would call.
    // A more robust test would involve mocking NextAuth.js's internal `signIn` process.

    // Test user creation
    let user = await User.findByEmail(mockGitHubProfile.email);
    expect(user).toBeNull();

    const newUser = await User.createUser({
      email: mockGitHubProfile.email,
      githubId: mockGitHubAccount.providerAccountId,
      profile: {
        name: mockGitHubProfile.name,
        avatar: mockGitHubProfile.image,
      },
      isEmailVerified: true,
      githubAccessToken: mockGitHubAccount.access_token,
    });

    expect(newUser).toBeDefined();
    expect(newUser.email).toBe(mockGitHubProfile.email);
    expect(newUser.githubId).toBe(mockGitHubAccount.providerAccountId);
    expect(newUser.githubAccessToken).toBe(mockGitHubAccount.access_token);

    // Test user update/linking
    const existingUser = await User.findByEmail(mockGitHubProfile.email);
    expect(existingUser).toBeDefined();

    existingUser.githubAccessToken = 'new-mock-github-access-token';
    await existingUser.save();

    const updatedUser = await User.findByEmail(mockGitHubProfile.email);
    expect(updatedUser.githubAccessToken).toBe('new-mock-github-access-token');
  });

  // Add more tests for error cases, e.g., invalid token, missing scopes
});

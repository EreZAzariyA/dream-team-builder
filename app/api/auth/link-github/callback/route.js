import { NextResponse } from 'next/server';
import { User } from '../../../../../lib/database/models/index.js';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=github_oauth_error`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=missing_params`);
    }

    // Parse state to get user info
    let stateData;
    try {
      stateData = JSON.parse(state);
    } catch {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=invalid_state`);
    }

    const { userId, callbackUrl } = stateData;

    // Exchange code for access token

    // Use curl-equivalent request format
    const requestBody = `client_id=${encodeURIComponent(process.env.GITHUB_ID)}&client_secret=${encodeURIComponent(process.env.GITHUB_SECRET)}&code=${encodeURIComponent(code)}`;


    const tokenResponse = await fetch('https://github.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NextAuth.js'
      },
      body: requestBody,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('No access token received');
    }

    // Get GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get GitHub user info');
    }

    const githubUser = await userResponse.json();

    // Connect to database and update user
    await connectMongoose();
    
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=user_not_found`);
    }

    // Check if GitHub account is already linked to another user
    const existingGitHubUser = await User.findOne({ githubId: githubUser.id.toString() });
    if (existingGitHubUser && existingGitHubUser._id.toString() !== userId) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=github_already_linked`);
    }

    // Link GitHub account to user
    user.githubId = githubUser.id.toString();
    user.githubAccessToken = accessToken;
    
    // Update profile if needed
    if (!user.profile.avatar && githubUser.avatar_url) {
      user.profile.avatar = githubUser.avatar_url;
    }

    await user.save();

    // Redirect back to integrations with success
    return NextResponse.redirect(`${callbackUrl || '/integrations'}?success=github_linked`);

  } catch (error) {
    logger.error('GitHub callback error:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=callback_failed`);
  }
}
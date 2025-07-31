import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the callback URL from query params
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get('callbackUrl') || '/integrations';

    // Build GitHub OAuth URL for account linking
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', process.env.GITHUB_ID);
    githubAuthUrl.searchParams.set('redirect_uri', `${process.env.NEXTAUTH_URL}/api/auth/link-github/callback`);
    githubAuthUrl.searchParams.set('scope', 'read:user user:email repo public_repo');
    githubAuthUrl.searchParams.set('state', JSON.stringify({
      userId: session.user.id,
      callbackUrl: callbackUrl
    }));


    return NextResponse.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('GitHub linking error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub linking' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const callbackUrl = searchParams.get('callbackUrl') || '/integrations';

    if (!provider || provider !== 'github') {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Store the current user ID and callback URL in the session for account linking
    const linkingUrl = `/api/auth/signin/github?callbackUrl=${encodeURIComponent(callbackUrl)}&accountLinking=true&existingUserId=${session.user.id}`;
    
    return NextResponse.redirect(linkingUrl);
  } catch (error) {
    console.error('Account linking error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate account linking' },
      { status: 500 }
    );
  }
}
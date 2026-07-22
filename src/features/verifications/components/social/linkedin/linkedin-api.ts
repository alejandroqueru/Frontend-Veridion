interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
}

interface LinkedInUser {
  id: string;
  firstName: {
    localized: Record<string, string>;
    preferredLocale: {
      country: string;
      language: string;
    };
  };
  lastName: {
    localized: Record<string, string>;
    preferredLocale: {
      country: string;
      language: string;
    };
  };
  profilePicture?: {
    displayImage: string;
  };
  emailAddress?: string;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn OAuth not configured');
  }

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to exchange code for token: ${errorData}`);
  }

  const data: LinkedInTokenResponse = await response.json();
  return data.access_token;
}

export async function getUserData(accessToken: string): Promise<LinkedInUser> {
  const response = await fetch('https://api.linkedin.com/v2/people/~:(id,firstName,lastName)', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user information');
  }

  const user: LinkedInUser = await response.json();
  return user;
}

export async function authenticateWithLinkedIn(code: string, redirectUri: string): Promise<LinkedInUser> {
  const accessToken = await exchangeCodeForToken(code, redirectUri);
  const user = await getUserData(accessToken);
  return user;
}

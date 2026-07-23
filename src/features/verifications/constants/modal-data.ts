// Modal data for different verification types

export const MODAL_DATA = {
  github: {
    title: "Verify your GitHub account ownership",
    points: "0/6",
    time: "5-10 minutes",
    price: "Free",
    status: "Account Verification",
    achievements: [
      {
        title: "Verify GitHub Account Ownership",
        points: 6,
        description: "Connect and verify ownership of your GitHub account."
      }
    ],
    requirements: [
      "Must have an active GitHub account",
      "Account must be at least 30 days old",
      "Must have at least one public repository"
    ]
  },
  linkedin: {
    title: "Verify your LinkedIn account ownership",
    points: "0/6",
    time: "1-2 minutes",
    price: "Free",
    status: "Account Verification",
    achievements: [
      {
        title: "Verify LinkedIn Account Ownership",
        points: 6,
        description: "Connect and verify ownership of your LinkedIn account."
      }
    ],
    requirements: [
      "Must have an active LinkedIn account",
      "Profile must be public or have appropriate privacy settings",
      "Account must be at least 30 days old"
    ]
  },
  google: {
    title: "Verify your Google account ownership",
    points: "0/6",
    time: "< 1 minute",
    price: "Free",
    status: "Account Verification",
    achievements: [
      {
        title: "Verify Google Account Ownership",
        points: 6,
        description: "Connect and verify ownership of your Google account."
      }
    ],
    requirements: [
      "Must have an active Google account",
      "Account must be verified with Google"
    ]
  },
  discord: {
    title: "Verify that you own a Discord account",
    points: "0/6",
    time: "1-2 minutes",
    price: "Free",
    status: "Account Verification",
    achievements: [
      {
        title: "Verify Discord Account Ownership",
        points: 6,
        description: "Connect and verify ownership of your Discord account"
      }
    ],
    requirements: [
      "Must have an active Discord account",
      "Account must be at least 7 days old"
    ]
  },
  "phone-verification": {
    title: "Verify your phone number",
    points: "1000",
    time: "< 2 minutes",
    price: "Free",
    status: "Contact Verification",
    achievements: [
      {
        title: "Phone Number Verified",
        points: 1000,
        description: "Prove you control a real phone number via SMS OTP."
      }
    ],
    requirements: [
      "Must have a valid phone number",
      "Phone number cannot be shared across multiple wallets",
      "Disposable or VoIP numbers may not be accepted"
    ]
  },
  "email-verification": {
    title: "Verify your email address",
    points: "500",
    time: "< 2 minutes",
    price: "Free",
    status: "Contact Verification",
    achievements: [
      {
        title: "Email Address Verified",
        points: 500,
        description: "Prove you control a real email address via OTP."
      }
    ],
    requirements: [
      "Must have a valid email address",
      "Disposable email domains are not accepted",
      "Email cannot be shared across multiple wallets"
    ]
  },
  "stellar-transactions": {
    title: "Verify your Stellar wallet activity",
    points: "0-50",
    time: "1-2 minutes",
    price: "Free",
    status: "Blockchain Verification",
    achievements: [
      {
        title: "Stellar Transaction Activity",
        points: 50,
        description: "Verify your Stellar wallet has transaction history and activity"
      }
    ],
    requirements: [
      "Must have a valid Stellar account ID",
      "Account must have at least 1 transaction",
      "Account must exist on Stellar network"
    ]
  },
  "government-id": {
    title: "Verify your identity with a government ID",
    points: "1000",
    time: "2-3 minutes",
    price: "Free",
    status: "Physical Verification",
    achievements: [
      {
        title: "Government ID Verified",
        points: 1000,
        description: "Prove your identity using a government-issued ID."
      }
    ],
    requirements: [
      "Must have a valid, unexpired government-issued ID",
      "Full legal name must match the ID"
    ]
  },
  binance: {
    title: "Verify your Binance KYC status",
    points: "1000",
    time: "1-2 minutes",
    price: "Free",
    status: "Physical Verification",
    achievements: [
      {
        title: "Binance KYC Verified",
        points: 1000,
        description: "Confirm your Binance KYC status via Binance Account Bound Token."
      }
    ],
    requirements: [
      "Must have completed KYC on Binance",
      "Must have a valid Binance Account Bound Token (BABT)"
    ]
  },
  biometrics: {
    title: "Verify your uniqueness with biometrics",
    points: "1000",
    time: "1-2 minutes",
    price: "Free",
    status: "Physical Verification",
    achievements: [
      {
        title: "Biometrics Verified",
        points: 1000,
        description: "Prove you are a unique human via a facial liveness check."
      }
    ],
    requirements: [
      "Must consent to a one-time facial liveness check",
      "Requires a working camera"
    ]
  },
  "proof-clean-hands": {
    title: "Prove you're not on sanctions lists",
    points: "1000",
    time: "1-2 minutes",
    price: "Free",
    status: "Physical Verification",
    achievements: [
      {
        title: "Clean Hands Verified",
        points: 1000,
        description: "Confirm you are not listed on any government sanctions list."
      }
    ],
    requirements: [
      "Must not appear on any government sanctions list"
    ]
  }
} as const;

export const getModalData = (verificationId: string) => {
  return MODAL_DATA[verificationId as keyof typeof MODAL_DATA] || null;
};

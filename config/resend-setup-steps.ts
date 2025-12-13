export interface SetupStepConfig {
  id: string
  title: string
  description?: string
  content: {
    type: "text" | "code" | "list" | "settings"
    data: any
  }[]
  links?: {
    text: string
    url: string
  }[]
}

export const resendSetupSteps: SetupStepConfig[] = [
  {
    id: "env-variable",
    title: "Add Resend API Key to Environment Variables",
    content: [
      {
        type: "text",
        data: "Add your Resend API key to your environment variables:",
      },
      {
        type: "code",
        data: "RESEND_API_KEY=re_your_api_key_here",
      },
    ],
    links: [
      {
        text: "Resend Dashboard",
        url: "https://resend.com/api-keys",
      },
    ],
  },
  {
    id: "test-connection",
    title: "Test Resend Connection",
    description: "Verify your API key is working correctly",
    content: [
      {
        type: "text",
        data: "Use the test button below to verify your Resend API key is working correctly.",
      },
    ],
  },
  {
    id: "configure-supabase",
    title: "Configure Supabase SMTP Settings",
    content: [
      {
        type: "text",
        data: "Configure Supabase to use Resend for sending emails:",
      },
      {
        type: "list",
        data: [
          "Go to your Supabase project dashboard",
          "Navigate to Authentication → Email Templates",
          'Click on "SMTP Settings" at the bottom',
          'Enable "Enable custom SMTP"',
          "Use these settings:",
        ],
      },
      {
        type: "settings",
        data: {
          Host: "smtp.resend.com",
          Port: "587",
          Username: "resend",
          Password: "your_resend_api_key",
          "Sender name": "Stick My Note",
          "Sender email": "noreply@yourdomain.com",
        },
      },
      {
        type: "text",
        data: 'Replace "yourdomain.com" with your verified domain in Resend',
      },
    ],
  },
  {
    id: "verify-domain",
    title: "Verify Your Domain (Optional but Recommended)",
    content: [
      {
        type: "text",
        data: "For production use, verify your domain in Resend:",
      },
      {
        type: "list",
        data: [
          "Go to Resend Dashboard → Domains",
          "Add your domain",
          "Add the required DNS records",
          "Update the sender email in Supabase SMTP settings",
        ],
      },
    ],
  },
]

// Shared handler logic for stick members (v1 + v2 deduplication)

// Build the invitation email HTML
export function buildInvitationEmailHtml(
  stickTitle: string,
  padTitle: string,
  role: string,
  inviteLink: string,
): string {
  return `
    <h2>Stick Invitation</h2>
    <p>You've been invited to collaborate on the stick "${stickTitle}" in the pad "${padTitle}".</p>
    <p>Role: ${role}</p>
    <p><a href="${inviteLink}">Click here to view the stick</a></p>
  `
}

// Build the invite link URL
export function buildInviteLink(siteUrl: string, padId: string, stickId: string): string {
  return `${siteUrl}/pads/${padId}?stick=${stickId}`
}

// Send invitation email (fire-and-forget, never fails the request)
export async function sendInvitationEmail(
  siteUrl: string,
  email: string,
  stickTitle: string,
  padTitle: string,
  role: string,
  inviteLink: string,
): Promise<void> {
  try {
    await fetch(`${siteUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: `You've been invited to collaborate on "${stickTitle}"`,
        html: buildInvitationEmailHtml(stickTitle, padTitle, role, inviteLink),
      }),
    })
  } catch (emailError) {
    console.error('Error sending invitation email:', emailError)
    // Don't fail the request if email fails
  }
}

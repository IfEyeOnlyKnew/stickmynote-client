# Organization Branding System

## Overview

The Stick My Note application now supports full organization branding, allowing each tenant to customize the application with their own logo, colors, and organization name. This makes the application truly white-label and ready for enterprise deployments.

## Features

### 1. Logo Customization
- **Light Mode Logo**: Primary logo displayed in light theme
- **Dark Mode Logo**: Optional variant for dark theme
- **Favicon**: Custom browser tab icon
- **Supported Formats**: PNG, JPG, WEBP, SVG
- **Maximum Size**: 5MB per file
- **Storage**: Vercel Blob with CDN distribution

### 2. Color Customization
- **Primary Color**: Main brand color used throughout the application
- **Secondary Color**: Supporting color for accents and highlights
- **Accent Color**: Used for CTAs and interactive elements
- **Format**: Hex color codes (#RRGGBB)
- **Live Preview**: See changes before saving

### 3. Display Name
- **Custom Organization Name**: Override the technical organization name with a display name
- **Browser Tab Title**: Automatically updates document title
- **Used Throughout App**: Displayed in headers, navigation, and branding elements

## For Users: How to Setup Organization Branding

### Step 1: Access Organization Settings
1. Log in to your organization
2. Click on your organization name in the top navigation
3. Click the "Settings" button (gear icon)
4. Navigate to the **Branding** tab

### Step 2: Upload Logo
1. **Light Mode Logo**:
   - Click "Upload Logo" under Light Mode Logo
   - Select your organization's logo file
   - Logo will be automatically uploaded and displayed

2. **Dark Mode Logo** (Optional):
   - Upload a version optimized for dark backgrounds
   - Falls back to light mode logo if not provided

3. **Favicon** (Optional):
   - Upload a small icon (recommended: 32x32 or 64x64 pixels)
   - Appears in browser tabs

### Step 3: Choose Brand Colors
1. **Primary Color**:
   - Click the color picker
   - Choose your brand's main color
   - Or enter hex code directly (e.g., #4F46E5)

2. **Secondary & Accent Colors**:
   - Follow same process for complementary colors
   - Use the preview section to see how they look together

### Step 4: Set Display Name (Optional)
- Enter a custom name that will appear throughout the app
- Leave blank to use the organization's technical name
- Example: "Acme Corporation" instead of "acme-corp-x7j2k"

### Step 5: Save Changes
1. Click "Save Branding" button
2. Refresh the page to see changes applied
3. All users in your organization will see the new branding

## For Developers: Technical Implementation

### Database Schema

Branding settings are stored in the `organizations.settings` JSONB column:

\`\`\`typescript
interface OrganizationSettings {
  branding?: {
    logo_url?: string              // CDN URL for light mode logo
    logo_dark_url?: string         // CDN URL for dark mode logo
    favicon_url?: string           // CDN URL for favicon
    primary_color?: string         // Hex color code
    secondary_color?: string       // Hex color code
    accent_color?: string          // Hex color code
    organization_display_name?: string  // Custom display name
  }
}
\`\`\`

### API Endpoints

#### Upload Logo/Favicon
\`\`\`typescript
POST /api/organizations/[orgId]/branding/upload
Content-Type: multipart/form-data

Body:
- file: File (image)
- type: 'logo' | 'logo_dark' | 'favicon'

Response:
{
  url: string,  // CDN URL of uploaded file
  type: string
}
\`\`\`

#### Update Branding Settings
\`\`\`typescript
PATCH /api/organizations/[orgId]
Content-Type: application/json

Body:
{
  settings: {
    branding: {
      primary_color: "#4F46E5",
      secondary_color: "#7C3AED",
      accent_color: "#06B6D4",
      organization_display_name: "My Company"
    }
  }
}
\`\`\`

### React Hooks

#### useOrgTheme
Automatically applies organization branding to the application:

\`\`\`typescript
import { useOrgTheme } from "@/lib/hooks/use-org-theme"

function MyComponent() {
  const { currentOrg } = useOrganization()
  useOrgTheme(currentOrg) // Applies CSS variables
}
\`\`\`

This hook sets the following CSS variables:
- `--brand-primary`: Primary brand color
- `--brand-secondary`: Secondary brand color
- `--brand-accent`: Accent color

#### Helper Functions

\`\`\`typescript
import { getOrgLogo, getOrgDisplayName } from "@/lib/hooks/use-org-theme"

// Get logo URL (with dark mode support)
const logoUrl = getOrgLogo(currentOrg, preferDark)

// Get display name
const displayName = getOrgDisplayName(currentOrg)
\`\`\`

### Components

#### OrgBrandedHeader
Displays organization logo and name:

\`\`\`typescript
import { OrgBrandedHeader } from "@/components/organization/org-branded-header"

<OrgBrandedHeader 
  showLogo={true} 
  showName={true}
  className="my-custom-class"
/>
\`\`\`

#### OrgThemeProvider
Wrap your app to apply organization theme globally (already included in layout):

\`\`\`typescript
import { OrgThemeProvider } from "@/components/organization/org-theme-provider"

<OrgThemeProvider>
  {children}
</OrgThemeProvider>
\`\`\`

### Using Brand Colors in Components

#### CSS Variables
\`\`\`css
.my-button {
  background-color: var(--brand-primary);
  border-color: var(--brand-secondary);
}

.my-accent {
  color: var(--brand-accent);
}
\`\`\`

#### Inline Styles
\`\`\`typescript
const { currentOrg } = useOrganization()
const primaryColor = currentOrg?.settings?.branding?.primary_color || '#4F46E5'

<div style={{ backgroundColor: primaryColor }}>
  Branded Content
</div>
\`\`\`

## Security & Permissions

### Who Can Update Branding?
- **Owner**: Full access to all branding settings
- **Admin**: Full access to all branding settings
- **Member**: Read-only access
- **Viewer**: Read-only access

### File Validation
- Maximum file size: 5MB
- Allowed types: PNG, JPG, WEBP, SVG
- Automatic CDN distribution via Vercel Blob
- Org-namespaced storage paths: `orgs/{orgId}/branding/{type}-{timestamp}-{filename}`

### Row-Level Security
All branding operations respect the existing RLS policies:
- Users can only view branding for organizations they're members of
- Only admins/owners can modify branding settings

## Best Practices

### Logo Design
- **Dimensions**: 200x60 pixels (width x height) recommended
- **Format**: SVG for scalability, PNG for photos
- **Background**: Transparent background preferred
- **Dark Mode**: Ensure logo is visible on dark backgrounds

### Color Selection
- **Contrast**: Ensure sufficient contrast for accessibility
- **Consistency**: Use colors from your existing brand guidelines
- **Testing**: Preview on both light and dark backgrounds
- **WCAG**: Aim for WCAG AA contrast ratios (4.5:1 for text)

### Performance
- **Image Optimization**: Compress images before upload
- **CDN**: All files automatically served via Vercel's global CDN
- **Caching**: Browser caching enabled for optimal performance

## Troubleshooting

### Logo Not Displaying
1. Check file size (must be under 5MB)
2. Verify file format (PNG, JPG, WEBP, SVG only)
3. Clear browser cache and hard reload
4. Check browser console for errors

### Colors Not Applying
1. Save branding settings after making changes
2. Refresh the page to reload CSS variables
3. Check that colors are valid hex codes (#RRGGBB)

### Permission Denied
1. Verify you have admin or owner role
2. Personal organizations have limited branding options
3. Check organization membership status

## Migration Guide

### Existing Organizations
All existing organizations can start using branding immediately:
1. No database migrations required (uses existing JSONB settings column)
2. Default colors and no logo will be used until configured
3. Branding is optional - apps work without customization

### Programmatic Setup
You can set branding via API for bulk operations:

\`\`\`bash
curl -X PATCH https://yourapp.com/api/organizations/{orgId} \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "branding": {
        "primary_color": "#FF5733",
        "secondary_color": "#3498DB",
        "accent_color": "#2ECC71",
        "organization_display_name": "Enterprise Client"
      }
    }
  }'
\`\`\`

## Future Enhancements

Potential features for future releases:
- Custom fonts
- Additional color variables
- Theme templates
- Advanced CSS customization
- Email template branding
- Custom domains
- White-label mobile apps

## Support

For issues or questions about organization branding:
1. Check this documentation first
2. Review the Settings → Organization → Branding tab
3. Contact support at your-support-email@domain.com
4. File issues on GitHub (if open source)

---

**Last Updated**: December 2024
**Version**: 1.0.0

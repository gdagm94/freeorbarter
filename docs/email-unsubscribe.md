# Email Unsubscribe Guide

This project now ships with a shared unsubscribe flow that works for web, Expo iOS, and any outbound email sent through Resend. Use this guide whenever you need to issue unsubscribe links or troubleshoot newsletter opt-outs.

## Database fields

The `newsletter_subscribers` table now contains:

- `unsubscribe_token uuid not null` – unique token embedded in each email link.
- `unsubscribed_at timestamptz` – the timestamp recorded when a user opts out.
- `is_unsubscribed boolean generated` – convenience flag derived from `unsubscribed_at`.

You can fetch or filter by these fields through Supabase Studio, SQL, or the generated TypeScript types in `src/types/supabase.ts`.

## Supabase Edge Function

- **Name:** `unsubscribe`
- **URL:** `https://<YOUR-SUPABASE-PROJECT>.functions.supabase.co/unsubscribe`
- **Methods:** `GET`, `POST`, plus `OPTIONS` for CORS pre-flight

### GET (email links)

```
GET https://<project>.functions.supabase.co/unsubscribe?token=UUID
```

The response is a minimal HTML confirmation page that can be opened inside iOS Mail or any browser. If the token is invalid or already used, the page explains what happened.

### POST (app/web buttons)

Use the Supabase client helper (`supabase.functions.invoke('unsubscribe', { body: { token, email } })`) or issue a raw `fetch`:

```http
POST https://<project>.functions.supabase.co/unsubscribe
Content-Type: application/json

{
  "token": "UUID",          // optional
  "email": "user@example.com" // optional
}
```

At least one of `token` or `email` is required. The handler returns JSON: `{ "success": true, "alreadyUnsubscribed": false }`.

## Embedding in Resend templates

1. Query `newsletter_subscribers` when building your Resend audience payload and include each row’s `unsubscribe_token` as part of your template data. Example personalization:

```json
{
  "to": "user@example.com",
  "substitution_data": {
    "name": "Jamie",
    "unsubscribe_token": "64a5c3d2-1f7a-4edc-bd11-f1a09c78c9cb"
  }
}
```

2. Inside the HTML template, add the link:

```html
<a href="https://<project>.functions.supabase.co/unsubscribe?token={{ unsubscribe_token }}">
  Unsubscribe
</a>
```

3. Resend will swap in the subscriber-specific token and the Edge Function will take care of updating `unsubscribed_at`.

## Testing / manual links

- Grab any token with `SELECT email, unsubscribe_token FROM newsletter_subscribers LIMIT 5;` via Supabase SQL.
- Visit `https://<project>.functions.supabase.co/unsubscribe?token=<token>` in a browser to verify the landing page.
- To reissue a token (rare), run `UPDATE newsletter_subscribers SET unsubscribe_token = gen_random_uuid(), unsubscribed_at = NULL WHERE email = 'user@example.com';`.

## In-app usage references

- Web footer action: `src/components/Footer.tsx`
- Expo iOS settings action: `FreeOrBarterMobile/src/screens/SettingsScreen.tsx`

Both clients call the same Edge Function, so no extra configuration is required beyond ensuring the Supabase client is initialized with your project URL and anon key.


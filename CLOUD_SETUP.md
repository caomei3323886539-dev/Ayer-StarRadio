# Ayer Star Radio — Cloud sync setup (v0.7.0 staging)

Project: `ayer-star-radio` / `nnoffobuktejgtmwfvbn` / `ap-northeast-1`

## Completed
- Auth support from the Cloud Library frontend; project currently uses Supabase email OTP.
- PostgreSQL tables: `public.radio_tracks`, `public.radio_playlists`, `public.radio_playlist_items`.
- Row-level access: owner-only SELECT/INSERT/UPDATE/DELETE on all three tables.
- Realtime publication enabled for all three tables.
- Storage policies: owner-only access to `ayer-audio` and `ayer-covers`, with object path `<auth-user-uuid>/<file-name>`.
- Cloud Library page: `/cloud.html` with browser-to-cloud upload, a local IndexedDB selector, private signed URL playback and subscription refresh.
- Original `ayer-star-radio` IndexedDB is not deleted or migrated automatically.

## Required in Supabase Dashboard
1. **Storage > New bucket**: create `ayer-audio`, **Private** (public OFF); recommended max file size 40 MB, with audio MIME types permitted. 
2. **Storage > New bucket**: create `ayer-covers`, **Private** (public OFF); recommended max file size 3 MB, image MIME types only.
3. **Authentication > URL Configuration**: set the Site URL to `https://caomei3323886539-dev.github.io/Ayer-StarRadio/` and add `https://caomei3323886539-dev.github.io/Ayer-StarRadio/cloud.html` to Redirect URLs.
4. Check Email provider in **Authentication > Providers**; leave email OTP enabled.

> Don't create public buckets; RLS policies already provisioned need no manual editing.

## How to test
- Open `https://caomei3323886539-dev.github.io/Ayer-StarRadio/cloud.html` on the phone.
- Sign in by email link and upload a small MP3 file.
- Open the same page on the desktop; log in with the exact same email.
- Verify the song appears and can play. Repeat with the desktop page already open and confirm a Realtime event updates the list.
- Verify a second account cannot see the original account's songs.
- Upload a local song from IndexedDB using the `本机已有歌曲` section.

## Notes
- Frontend is a staging integration; end-to-end upload/auth tests cannot pass until Storage buckets and Auth redirect configuration exist.
- Files remain private under owner UUID directories.
- Never add a service-role secret to GitHub Pages. The configured browser key is Supabase's **publishable** key.
- Avoid clearing site data; original songs are local IndexedDB blobs.

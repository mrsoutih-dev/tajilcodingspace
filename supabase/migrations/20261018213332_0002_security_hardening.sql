/*
# Security hardening: function permissions and search paths

Fixes three security advisor warnings:
1. Locks down `handle_new_user()` so only the system can execute it —
   it is a signup trigger and must never be callable by end users.
2. Pins the `search_path` on `touch_updated_at()` so it cannot be
   hijacked by a malicious schema placement.
3. Pins the `search_path` on `handle_new_user()`.

## Security changes
- REVOKE EXECUTE on `handle_new_user()` from `anon` and `authenticated`.
- `SET search_path = ''` on both functions (fully pinned, schema-qualified
  references inside the function bodies keep working).

## Important notes
1. `handle_new_user()` stays SECURITY DEFINER (required for trigger use),
   but is no longer callable through the Data API by any user role.
2. No data is modified.
*/

-- Lock down handle_new_user (only the auth trigger path may use it)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
ALTER FUNCTION public.handle_new_user() SET search_path = '';

-- Pin search path on the trigger helper
ALTER FUNCTION public.touch_updated_at() SET search_path = '';

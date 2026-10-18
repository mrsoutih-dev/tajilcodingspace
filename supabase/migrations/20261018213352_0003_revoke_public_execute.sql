/*
# Revoke PUBLIC execute on handle_new_user

The function still inherits the database-wide default grant to PUBLIC.
Revoke it so the signup trigger is the only execution path; service_role
keeps access (re-granted explicitly) for administrative use.

## Security changes
- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC.
- GRANT EXECUTE to service_role explicitly.

## Important notes
1. No data is modified; permissions only.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

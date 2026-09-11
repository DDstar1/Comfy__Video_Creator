// Call only with a user returned by Supabase auth.getUser(), never request data.
export function hasUnlimitedGeneration(user: {
  email?: string;
  email_confirmed_at?: string;
}) {
  return Boolean(user.email_confirmed_at) &&
    user.email?.toLowerCase() === "abhuluimendestiny@gmail.com";
}

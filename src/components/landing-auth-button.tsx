"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AuthForm } from "./studio-forms";

export default function LandingAuthButton({
  children,
  className,
  mode = "signup",
  hideWhenSignedIn = false,
}: {
  children: ReactNode;
  className?: string;
  mode?: "signin" | "signup";
  hideWhenSignedIn?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (user && hideWhenSignedIn) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => (user ? router.push("/studio") : setOpen(true))}
      >
        {user ? "Open studio" : children}
      </button>
      {open && (
        <AuthForm
          defaultMode={mode}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            router.push("/studio");
          }}
        />
      )}
    </>
  );
}

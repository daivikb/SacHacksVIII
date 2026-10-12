import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { isAdmin, isHardcodedAdmin } from "@/services/admin.service";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  // The role lookup is stored with the uid it belongs to, so a result from a
  // previous session can never be read as the current user's.
  const [checked, setChecked] = useState<{ uid: string; allowed: boolean } | null>(null);
  const hardcoded = isHardcodedAdmin();
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (hardcoded || authLoading || !uid) return;

    let active = true;
    void isAdmin(uid).then((allowed) => {
      if (active) setChecked({ uid, allowed });
    });
    return () => { active = false; };
  }, [hardcoded, authLoading, uid]);

  if (hardcoded) return { isAdmin: true, loading: false };

  const resolved = !uid || checked?.uid === uid;
  return {
    isAdmin: !!uid && checked?.uid === uid && checked.allowed,
    loading: authLoading || !resolved,
  };
}

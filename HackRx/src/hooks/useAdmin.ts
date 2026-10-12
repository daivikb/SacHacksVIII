import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { isAdmin, isHardcodedAdmin } from "@/services/admin.service";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [admin, setAdmin] = useState(isHardcodedAdmin());
  const [loading, setLoading] = useState(!isHardcodedAdmin());

  useEffect(() => {
    let active = true;

    if (isHardcodedAdmin()) {
      setAdmin(true);
      setLoading(false);
      return;
    }

    if (authLoading) return;
    if (!user) {
      setAdmin(false);
      setLoading(false);
      return;
    }

    let active = true;
    void isAdmin(uid).then((allowed) => {
      if (active) setChecked({ uid, allowed });
    });
    return () => { active = false; };
  }, [hardcoded, authLoading, uid]);

  if (hardcoded) return { isAdmin: true, loading: false };

  return { isAdmin: admin, loading: isHardcodedAdmin() ? false : authLoading || loading };
}
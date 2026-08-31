import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { getPresetAvatar, getDefaultAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * User avatar — uploaded → preset → initials fallback.
 *
 * Pass className to set size (e.g. "h-8 w-8"). The component supplies
 * surface/border defaults consistent with the design system.
 */
export default function Avatar({ user, className }) {
  const custom = !!user?.has_custom_avatar;

  const { data } = useQuery({
    queryKey: ["avatar-url", user?.id],
    queryFn: async () => {
      const { data: d } = await api.get("/auth/me/avatar/");
      return d.url;
    },
    enabled: custom,
    staleTime: 20 * 60_000,
  });

  let src = null;
  if (custom && data) src = data;
  else if (!custom) src = getPresetAvatar(user?.avatar_preset) || getDefaultAvatar(user?.gender);

  const base =
    "shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-[650] text-[var(--fg-soft)] tracking-[.02em] overflow-hidden";

  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(base, className)}
      >
        {(user?.first_name?.[0] || user?.email?.[0] || "?").toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={cn(base, "object-cover", className)}
      draggable="false"
    />
  );
}

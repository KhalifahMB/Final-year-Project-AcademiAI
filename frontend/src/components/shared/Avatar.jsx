import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { getPresetAvatar, getDefaultAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * User avatar with graceful fallbacks:
 * uploaded picture → chosen preset → gender default → neutral.
 *
 * `user` is the auth user object (needs has_custom_avatar / avatar_preset /
 * gender). The presigned URL for an uploaded picture is fetched lazily and
 * cached by react-query.
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

  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold uppercase text-primary",
          className,
        )}
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
      className={cn("shrink-0 rounded-full object-cover", className)}
      draggable="false"
    />
  );
}

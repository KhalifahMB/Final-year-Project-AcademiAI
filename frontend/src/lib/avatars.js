/**
 * Avatar preset registry.
 *
 * Presets are bundled SVG illustrations; ids are stored on the user record
 * (User.avatar_preset). Gender-based defaults are used when no preset and
 * no uploaded picture exist.
 */
import male1 from "@/assets/avatars/male-1.svg";
import male2 from "@/assets/avatars/male-2.svg";
import male3 from "@/assets/avatars/male-3.svg";
import female1 from "@/assets/avatars/female-1.svg";
import female2 from "@/assets/avatars/female-2.svg";
import female3 from "@/assets/avatars/female-3.svg";

export const AVATAR_PRESETS = [
  { id: "male-1", label: "Amir", src: male1 },
  { id: "male-2", label: "David", src: male2 },
  { id: "male-3", label: "Kofi", src: male3 },
  { id: "female-1", label: "Aisha", src: female1 },
  { id: "female-2", label: "Zainab", src: female2 },
  { id: "female-3", label: "Lena", src: female3 },
];

export const DEFAULT_AVATARS = {
  male: male1,
  female: female1,
  other: male3,
  unspecified: male3,
};

export function getPresetAvatar(id) {
  return AVATAR_PRESETS.find((p) => p.id === id)?.src || null;
}

export function getDefaultAvatar(gender) {
  return DEFAULT_AVATARS[gender] || DEFAULT_AVATARS.unspecified;
}

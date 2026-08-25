/**
 * AcademiAI logo mark using the brand image assets, with automatic
 * light/dark variants. Shared by the landing page and auth screens so
 * branding stays identical everywhere.
 */
export default function BrandMark({ size = "h-9 w-9" }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border`}
    >
      <img
        src="/images/Logo/academiai_icon_light.webp"
        alt=""
        aria-hidden
        className="h-full w-full object-contain dark:hidden"
      />
      <img
        src="/images/Logo/academiai_icon_dark.png"
        alt=""
        aria-hidden
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}

export default function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-12">
      <span className="inline-block h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  );
}

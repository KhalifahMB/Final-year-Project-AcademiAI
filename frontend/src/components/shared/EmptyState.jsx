import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function EmptyState({ icon: Icon, illustration: Illustration, title, description, action, actionTo, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center">
      {Illustration ? (
        <Illustration className="mb-5 h-24 w-24 text-muted-foreground" />
      ) : Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action && actionTo ? (
        <Button asChild className="mt-5">
          <Link to={actionTo}>{action}</Link>
        </Button>
      ) : action && onAction ? (
        <Button type="button" className="mt-5" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}

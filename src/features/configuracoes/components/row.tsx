export function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="min-w-0 md:flex-1">
        <div className="text-sm font-medium">{title}</div>
        {desc ? <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div> : null}
      </div>
      <div className="flex min-w-0 md:w-[min(45%,340px)] md:shrink-0 md:justify-end">
        {children}
      </div>
    </div>
  );
}

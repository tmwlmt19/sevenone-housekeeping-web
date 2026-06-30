interface PagePlaceholderProps {
  title: string
  description: string
}

/** Temporary scaffold content. Replaced as each feature phase is built out. */
export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

import { ComponentPropsWithoutRef, ReactNode } from "react"
import { ArrowRightIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string
  className: string
  background: ReactNode
  Icon: React.ElementType
  description: string
  href: string
  cta: string
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 lg:grid-cols-2 gap-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  ...props
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-3 flex flex-col overflow-hidden",
      // Operational design: border instead of box-shadow
      "bg-card/50 border border-border",
      "hover:border-primary/40 transition-colors duration-300",
      className
    )}
    {...props}
  >
    {/* Background animation area - fills remaining space */}
    <div className="flex-1 relative min-h-0">{background}</div>

    {/* Content area - fixed at bottom */}
    <div className="relative bg-background/80 backdrop-blur-sm p-6 border-t border-border">
      <div className="flex flex-col gap-2">
        <Icon className="h-8 w-8 text-primary" />
        <h3 className="text-lg font-semibold text-foreground mt-2">
          {name}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>

      <div className="flex w-full flex-row items-center mt-4 lg:hidden">
        <Button variant="link" size="sm" className="p-0 text-primary hover:text-primary/80" render={<a href={href} />} nativeButton={false}>
          {cta}
          <ArrowRightIcon className="ms-2 h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      {/* Desktop hover CTA */}
      <div
        className={cn(
          "hidden w-full translate-y-2 flex-row items-center opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex mt-4"
        )}
      >
        <Button variant="link" size="sm" className="p-0 text-primary hover:text-primary/80" render={<a href={href} />} nativeButton={false}>
          {cta}
          <ArrowRightIcon className="ms-2 h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>

    {/* Hover overlay */}
    <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-primary/5" />
  </div>
)

export { BentoCard, BentoGrid }

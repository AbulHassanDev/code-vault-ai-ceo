import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { INDUSTRIES } from "@/lib/industries";
import { IndustryIcon } from "@/components/industry-icon";

/** Navbar mega-menu listing industry verticals; each entry deep-links to a filtered catalog. */
export function CategoriesMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex items-center gap-1 rounded-md px-3.5 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground">
        Categories
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={10}
        className="w-[min(92vw,640px)] p-2 sm:grid sm:grid-cols-2 sm:gap-1"
      >
        {INDUSTRIES.map((ind) => (
          <DropdownMenuItem key={ind.slug} asChild className="cursor-pointer rounded-lg p-0">
            <Link
              to="/"
              search={{ industry: ind.slug }}
              hash="catalog"
              className="flex w-full items-start gap-3 rounded-lg p-2.5"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <IndustryIcon name={ind.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight text-foreground">{ind.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{ind.blurb}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

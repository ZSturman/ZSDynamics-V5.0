import { Resource } from "@/types";
import { Button } from "../ui/button";
import { getProjectHref } from "@/lib/project-paths";
import { bestIconPath } from "@/lib/resource-map";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { trackProjectResourceClick } from "@/lib/firebase-analytics";
import { cn } from "@/lib/utils";

export default function ResourceButton({
  resource,
  className,
  iconOnly = false,
  showLabelOnMd = false,
  iconSize = 16,
  currentProject
}: {
  resource: Resource;
  className?: string;
  iconOnly?: boolean;
  showLabelOnMd?: boolean;
  iconSize?: number;
  currentProject?: { id: string; title?: string; name?: string; slug?: string; href?: string };
}) {

  const router = useRouter();
  const { setPreviousPath } = useBreadcrumb();

  // Check if this is a folio resource (local project link)
  const isFolio = resource.type === "folio" || resource.type === "Folio" || (typeof resource.url === "string" && resource.url.startsWith("/projects/") && resource.category !== "download");

  const icon = bestIconPath(isFolio ? "folio" : resource.type, undefined, resource);
  const shouldInvertIcon = icon.startsWith("/icons/") && !icon.startsWith("/icons/favicons/");
  
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackProjectResourceClick({
      projectSlug: currentProject?.slug || currentProject?.id,
      projectTitle: currentProject?.title || currentProject?.name,
      resourceType: resource.type,
      resourceLabel: resource.label,
      resourceUrl: resource.url,
      isInternal: isFolio,
    });

    if (isFolio) {
      // Set breadcrumb to current project before navigating to another project
      if (currentProject) {
        setPreviousPath(getProjectHref(currentProject), currentProject.title || currentProject.name || 'Project');
      }
      // Navigate to the local page without opening a new tab
      router.push(resource.url);
    } else {
      // Open external links in a new tab
      window.open(resource.url, "_blank", "noopener,noreferrer");
    }
  };
  
  if (iconOnly) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "h-9 w-9 shrink-0 rounded-full border-border/70 bg-background/85 text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50",
          className
        )}
        onClick={handleClick}
        title={resource.label}
        aria-label={resource.label}
      >
        <Image
          className={shouldInvertIcon ? "dark:invert" : undefined}
          src={icon}
          alt={resource.type}
          width={iconSize}
          height={iconSize}
        />
      </Button>
    );
  }
  
  // Show icon only on mobile, with label on md+ screens
  if (showLabelOnMd) {
    return (
      <Button
        variant="ghost"
        className={className || "h-8 w-8 md:h-auto md:w-auto md:px-3 md:py-1.5 shrink-0 "}
        onClick={handleClick}
        title={resource.label}
      >
        <Image
          className={cn(shouldInvertIcon && "dark:invert", "shrink-0")}
          src={icon}
          alt={resource.type}
          width={iconSize}
          height={iconSize}
        />
        <span className="hidden md:inline ml-1.5 text-xs font-medium truncate max-w-[120px]">
          {resource.label} {isFolio && " - project page"}
        </span>
      </Button>
    );
  }
  
  return (
    <Button
      variant="outline"
      className={className || "h-auto min-h-[22px] max-w-full justify-start bg-transparent px-3 py-1 opacity-70 hover:cursor-pointer hover:opacity-100 md:min-h-[36px] md:gap-3 md:px-4"}
      onClick={handleClick}
    >
      <Image
        className={cn(shouldInvertIcon && "dark:invert", "shrink-0")}
        src={icon}
        alt={resource.type}
        width={iconSize}
        height={iconSize}
      />
      <div className="min-w-0 truncate text-left">
        <div className="truncate text-xs md:text-xs">{resource.label} </div>
        {/* {!isFolio && (
          <div className="text-[10px] md:text-xs text-muted-foreground break-all truncate">{resource.url}</div>
        )} */}
      </div>
    </Button>
  );
}

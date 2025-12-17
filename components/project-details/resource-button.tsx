import { Resource } from "@/types";
import { Button } from "../ui/button";
import { bestIconPath } from "@/lib/resource-map";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useBreadcrumb } from "@/lib/breadcrumb-context";

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
  currentProject?: { id: string; title?: string; name?: string };
}) {

  const router = useRouter();
  const { setPreviousPath } = useBreadcrumb();

    // Check if this is a folio resource (local project link)
  const isFolio = resource.type === "folio" || resource.type === "Folio" || (typeof resource.url === "string" && resource.url.startsWith("/projects/") && resource.category !== "download");

  const icon = bestIconPath(isFolio ? "folio" : resource.type);
  
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolio) {
      // Set breadcrumb to current project before navigating to another project
      if (currentProject) {
        setPreviousPath(`/projects/${currentProject.id}`, currentProject.title || currentProject.name || 'Project');
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
        variant="ghost"
        size="icon"
        className={className || "h-10 w-10 shrink-0"}
        onClick={handleClick}
        title={resource.label}
      >
        <Image
          className="dark:invert"
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
          className="dark:invert shrink-0"
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
      className={className || "justify-start md:gap-3 h-auto md:px-4 px-3 py-1 bg-transparent w-auto max-w-full hover:cursor-pointer min-h-[22px] md:min-h-[36px] opacity-70 hover:opacity-100"}
      onClick={handleClick}
    >
      <Image
        className="dark:invert shrink-0"
        src={icon}
        alt={resource.type}
        width={iconSize}
        height={iconSize}
      />
      <div className="text-left truncate">
        <div className="truncate text-xs md:text-xs">{resource.label} </div>
        {/* {!isFolio && (
          <div className="text-[10px] md:text-xs text-muted-foreground break-all truncate">{resource.url}</div>
        )} */}
      </div>
    </Button>
  );
}

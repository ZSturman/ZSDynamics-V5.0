"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import ResourceButton from "../project-details/resource-button";
import { useRouter } from "next/navigation";
import { getProjectHref } from "@/lib/project-paths";
import type { Project, Resource } from "@/types";

export default function PrimaryActionButton({
  project,
  resource,
  className,
}: {
  project: Project;
  resource?: Resource;
  className?: string;
}) {
  const router = useRouter();

  if (resource) {
    return <ResourceButton resource={resource} className={className} />;
  }

  return (
    <Button
      variant="outline"
      className={className || "justify-start gap-2 md:gap-3 h-auto p-2 md:px-4 px-3 bg-transparent w-auto max-w-full hover:cursor-pointer min-h-[44px]"}
      onClick={(e) => {
        e.stopPropagation();
        router.push(getProjectHref(project));
      }}
    >
      <Image
        className="dark:invert shrink-0"
        src="/icons/file.svg"
        alt="Details"
        width={16}
        height={16}
      />
      <div className="text-left truncate">
        <div className="font-medium truncate text-xs md:text-sm">More Details</div>
      </div>
    </Button>
  );
}

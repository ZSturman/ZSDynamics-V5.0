import { Project } from "@/types";
import { MetadataTag } from "../ui/metadata-text";

export default function ProjectTags({ project }: { project: Project }) {
  return project.tags?.length ? (
    <div className="mt-3 md:mt-4">
      <div className="flex flex-wrap gap-x-2 gap-y-1 md:gap-x-3">
        {project.tags.map((tag) => (
          <MetadataTag key={tag} tag={tag} size="sm" className="text-[10px] md:text-xs" />
        ))}
      </div>
    </div>
  ) : null;
}

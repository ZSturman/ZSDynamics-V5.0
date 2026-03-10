import { Project } from "@/types";
import { MediaDisplay } from "@/components/ui/media-display";

export default function ThumbnailView({
  project,
  image,
}: {
  project: Project;
  image: string;
}) {
  // Get video settings for thumbnail
  const thumbnailSettings = project.imageSettings?.thumbnail;
  
  return (
    <div className="flex justify-center">
      <div className="relative w-full max-w-sm aspect-square overflow-hidden rounded-lg">
        <MediaDisplay
          src={image || "/placeholder.svg"}
          alt={project.title}
          fill
        className="object-contain"
          loop={thumbnailSettings?.loop ?? true}
          autoPlay={thumbnailSettings?.autoPlay ?? false}
        />
      </div>
    </div>
  );
}

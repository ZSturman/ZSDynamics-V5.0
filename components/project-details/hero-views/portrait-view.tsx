import { MediaDisplay } from "@/components/ui/media-display";
import { Project } from "@/types";

export default function PortraitView({ project, image }: { project: Project; image: string }) {
  // Get video settings for poster
  const posterSettings = project.images?.posterPortrait 
    ? project.imageSettings?.posterPortrait 
    : project.imageSettings?.poster;
  
  return (
    <div className="flex justify-center">
      <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden rounded-lg">
        <MediaDisplay
          src={image || "/placeholder.svg"}
          alt={project.title}
          fill
          className="object-cover"
          priority
          loop={posterSettings?.loop ?? true}
          autoPlay={posterSettings?.autoPlay ?? false}
        />
      </div>
    </div>
  );
}

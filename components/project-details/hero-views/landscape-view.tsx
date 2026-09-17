import { Project } from "@/types";
import { MediaDisplay } from "@/components/ui/media-display";

export default function LandscapeView({
  project,
  image,
}: {
  project: Project;
  image: string;
}) {
  // Get video settings for banner
  const bannerSettings = project.imageSettings?.banner;
  
  return (
    <div className="relative w-full aspect-video md:aspect-[2/1] overflow-hidden rounded-lg">
      <MediaDisplay
        src={image || "/placeholder.svg"}
        alt={project.title}
        fill
        className="object-cover"
        priority
        loop={bannerSettings?.loop ?? true}
        autoPlay={bannerSettings?.autoPlay ?? false}
      />
    </div>
  );
}

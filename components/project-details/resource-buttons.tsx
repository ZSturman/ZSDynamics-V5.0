import { Project } from "@/types";
import ResourceButton from "./resource-button";
import { getProjectResources } from "@/lib/project-resources";
import { isSecondaryResource } from "@/lib/project-presentation";

export default function ResourceButtons({ project, showMessage = true }: { project: Project, showMessage?: boolean }) {
  const resources = getProjectResources(project.resources);
  // Install/demo/source stay primary; support, privacy and story links follow quietly.
  const primary = resources.filter((resource) => !isSecondaryResource(resource));
  const secondary = resources.filter(isSecondaryResource);
  return resources.length ? (
    <div className="space-y-2">
      <div data-testid="project-primary-actions" className="flex max-w-full flex-row flex-wrap gap-2 overflow-hidden">
        {(primary.length ? primary : secondary).map((resource, index) => {
          return <ResourceButton key={`${resource.url}-${index}`} resource={resource} currentProject={project} />;
        })}
      </div>
      {primary.length && secondary.length ? (
        <div data-testid="project-secondary-actions" className="flex max-w-full flex-row flex-wrap gap-2 overflow-hidden">
          {secondary.map((resource, index) => {
            return <ResourceButton key={`${resource.url}-${index}`} resource={resource} currentProject={project} />;
          })}
        </div>
      ) : null}
    </div>
  ) : showMessage ? (
    <div className="space-y-3">
      <p className="text-muted-foreground leading-relaxed text-pretty">
        {project.status === "idea" && (
          <>
            This is something that&apos;s coming in the future. Email
            zasturman@gmail.com for details.
          </>
        )}
        {project.status === "in_progress" && (
          <>
            This is currently a work in progress. Email zasturman@gmail.com for
            details.
          </>
        )}
        {project.status !== "idea" && project.status !== "in_progress" && (
          <>
            No external resources are published. Email zasturman@gmail.com to
            learn more.
          </>
        )}
      </p>
    </div>
  ) : null;
}

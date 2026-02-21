"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Project } from "@/types";
import { Badge } from "@/components/ui/badge";

import { ProjectHeader } from "./project-banner";
import ProjectHero from "./project-hero";
import { Collection } from "./collection/collection";
import ProjectDescriptionAndStory from "./project-description-and-story";
import ResourceButtons from "./resource-buttons";
import { ProjectSidebar } from "./project-sidebar";
import { ProjectMetadata } from "./project-metadata";
import { ProjectWorkLogs } from "./project-work-logs";

interface ProjectDetailsProps {
  project: Project;
}

function HomeLink({ projectTitle, isScrolled }: { projectTitle: string; isScrolled: boolean }) {
  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border transition-all duration-300">
      <div className="container mx-auto px-3 md:px-6 lg:px-8 py-2 md:py-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 md:gap-2 text-xs md:text-sm text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            ← <span className="hidden md:inline">Home</span>
          </Link>
          
          {/* Show title when scrolled on mobile */}
          {isScrolled && (
            <h2 className="md:hidden text-xs font-medium text-foreground truncate flex-1 text-center px-2">
              {projectTitle}
            </h2>
          )}
          
          <div className="w-8 md:hidden" /> {/* Spacer for centering on mobile */}
        </div>
      </div>
    </div>
  );
}

/** Inline status badge for mobile - shown at top of content */
function MobileStatusBadge({ project }: { project: Project }) {
  const getStatusLabel = (status: string, subStatus?: string) => {
    if (subStatus) {
      return `${status} (${subStatus.replace(/_/g, " ")})`;
    }
    return status.replace(/_/g, " ");
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case "done":
        return "default";
      case "in_progress":
      case "in progress":
        return "secondary";
      case "idea":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (!project.status) return null;

  return (
    <div className="lg:hidden mb-4">
      <Badge
        variant={getStatusVariant(project.status)}
        className="text-xs px-2 py-0.5 pointer-events-none cursor-default"
      >
        {getStatusLabel(project.status, project.phase)}
      </Badge>
    </div>
  );
}

/** Check if project has substantial content to warrant two-column layout */
function hasSubstantialContent(project: Project): boolean {
  const hasCollection = project.collection && Object.keys(project.collection).length > 0;
  const hasDescription = project.description && project.description.trim().length > 0;
  const hasStory = project.story && project.story.trim().length > 0;
  const hasResources = project.resources && project.resources.length > 0;
  
  // Count how many content sections we have
  let contentSections = 0;
  if (hasCollection) contentSections++;
  if (hasDescription) contentSections++;
  if (hasStory) contentSections++;
  if (hasResources) contentSections++;
  
  return contentSections >= 2;
}

export function ProjectDetails({ project }: ProjectDetailsProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      // Check if we've scrolled past the header
      if (headerRef.current) {
        const headerBottom = headerRef.current.getBoundingClientRect().bottom;
        setIsScrolled(headerBottom < 60); // 60px is approximately the sticky nav height
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const hasCollection = project.collection && Object.keys(project.collection).length > 0;
  const hasResources = project.resources && project.resources.length > 0;
  const hasWorkLogs = project.workLogs && project.workLogs.length > 0;
  const useTwoColumnLayout = hasSubstantialContent(project);

  return (
    <div className="min-h-screen bg-background">
      <HomeLink projectTitle={project.title} isScrolled={isScrolled} />

      {/* Main Content Container */}
      <main className="container mx-auto px-3 md:px-6 lg:px-8 py-6 md:py-12 lg:py-16">
        {/* Header Section - Always Full Width */}
        <div ref={headerRef}>
          <ProjectHeader project={project} />
        </div>

        {/* Mobile Status Badge - Only visible on smaller screens */}
        <MobileStatusBadge project={project} />

        {/* Two-Column Layout for lg+ screens when there's enough content */}
        {useTwoColumnLayout ? (
          <div className="mt-6 md:mt-8 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 xl:gap-12">
            {/* Main Content Column */}
            <div className="space-y-8 md:space-y-10">
              {/* 1. Resource Buttons - Primary CTA */}
              {hasResources && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Resources</h3>
                  <ResourceButtons project={project} showMessage={false} />
                </section>
              )}

              {/* 2. Project Hero/Media */}
              <section>
                <ProjectHero project={project} />
              </section>

              {/* 3. Collections */}
              {hasCollection && (
                <section>
                  <Collection project={project} inModal={false} />
                </section>
              )}

              {/* 4. Description & Story */}
              <section>
                <ProjectDescriptionAndStory project={project} />
              </section>

              {hasWorkLogs && (
                <section>
                  <ProjectWorkLogs project={project} />
                </section>
              )}

              {/* Mobile-only: Show metadata at bottom on smaller screens */}
              <div className="lg:hidden">
                <ProjectMetadata project={project} />
              </div>
            </div>

            {/* Sidebar Column - Sticky on desktop */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <ProjectSidebar project={project} />
              </div>
            </aside>
          </div>
        ) : (
          /* Single Column Layout for simpler projects */
          <div className="mt-6 md:mt-8 max-w-3xl mx-auto space-y-8 md:space-y-10">
            {/* 1. Resource Buttons */}
            {hasResources && (
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Resources</h3>
                <ResourceButtons project={project} showMessage={false} />
              </section>
            )}

            {/* 2. Project Hero/Media */}
            <section>
              <ProjectHero project={project} />
            </section>

            {/* 3. Collections */}
            {hasCollection && (
              <section>
                <Collection project={project} inModal={false} />
              </section>
            )}

            {/* 4. Description & Story */}
            <section>
              <ProjectDescriptionAndStory project={project} />
            </section>

            {hasWorkLogs && (
              <section>
                <ProjectWorkLogs project={project} />
              </section>
            )}

            {/* 5. Metadata - Full width in single column */}
            <section>
              <ProjectMetadata project={project} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}


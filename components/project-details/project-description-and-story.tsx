"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Project } from "@/types";
import { ArticleMarkdown } from "@/components/articles/article-markdown";
import { formatTextWithNewlines } from "@/lib/utils";
import { ExpandableCardContent } from "./expandable-card-content";

const README_COLLAPSE_THRESHOLD = 2200;

interface Props {
  project: Project;
}

/**
 * Renders Description / Summary for a project.
 * Behavior:
 * - If neither description nor story -> returns null
 * - If only one is present -> renders it directly (no tabs)
 * - If both are present -> render Tabs to switch between them
 */
export default function ProjectDescriptionAndStory({ project }: Props) {
  const description =
    (project.description && String(project.description).trim()) || "";
  const story = (project.story && String(project.story).trim()) || "";

  const hasDescription = description.length > 0;
  const hasStory = story.length > 0;

  if (!hasDescription && !hasStory) return null;

  // Single renderer used in both the tab and single-view cases
  function RenderContent({
    title,
    content,
  }: {
    title: string;
    content: string;
  }) {
    return (
      <Card>
        <CardContent className="p-3 md:p-6">
          {title && (
            <h2 className="text-base md:text-xl font-semibold mb-2">{title}</h2>
          )}
          <div className="prose max-w-none whitespace-pre-wrap text-sm md:text-base">
            {formatTextWithNewlines(content)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasDescription && !hasStory) {
    return <RenderContent title="Description" content={description} />;
  }

  if (!hasDescription && hasStory) {
    return <RenderContent title="Summary" content={story} />;
  }

  // Both present -> show tabs
  return (
    <div className="w-full">
      <Tabs defaultValue="story" className="w-full">
        <TabsList className="text-xs md:text-sm">
          <TabsTrigger
            value="story"
            className="text-xs md:text-sm px-2 md:px-4"
          >
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="description"
            className="text-xs md:text-sm px-2 md:px-4"
          >
            Description
          </TabsTrigger>
        </TabsList>

        <TabsContent value="story">
          <RenderContent title="Summary" content={story} />
        </TabsContent>

        <TabsContent value="description">
          <RenderContent title="Description" content={description} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ProjectContentProps {
  project: Project;
  showReadme?: boolean;
}

export function ProjectContent({ project, showReadme = true }: ProjectContentProps) {
  const description =
    (project.description && String(project.description).trim()) || "";
  const story = (project.story && String(project.story).trim()) || "";
  const readmeContent =
    showReadme && project.readme?.content
      ? String(project.readme.content).trim()
      : "";
  const readmeSourceUrl =
    showReadme && typeof project.readme?.sourceUrl === "string"
      ? project.readme.sourceUrl
      : undefined;

  const hasDescription = description.length > 0;
  const hasStory = story.length > 0;
  const hasReadme = readmeContent.length > 0;

  if (!hasDescription && !hasStory && !hasReadme) return null;

  return (
    <article className="space-y-8">
      {hasDescription && (
        <section id="description" className="scroll-mt-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">Description</h2>
          <div className="text-base md:text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {formatTextWithNewlines(description)}
          </div>
        </section>
      )}

      {hasStory && (
        <section id="story" className="scroll-mt-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">Story</h2>
          <div className="text-base md:text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap border-l-4 border-primary/20 pl-6">
            {formatTextWithNewlines(story)}
          </div>
        </section>
      )}

      {hasReadme && (
        <section id="readme" data-testid="project-readme" className="scroll-mt-24">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5 shadow-sm md:p-6">
            {readmeSourceUrl ? (
              <div className="mb-4 flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <a
                    data-testid="project-readme-source"
                    href={readmeSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Source
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </Button>
              </div>
            ) : null}

            <ExpandableCardContent
              contentLength={readmeContent.length}
              threshold={README_COLLAPSE_THRESHOLD}
              collapsedHeightClassName="max-h-[34rem]"
              collapsedHeightPx={544}
              minCollapsedOverflowPx={160}
              testId="project-readme-expandable"
            >
              <ArticleMarkdown
                content={readmeContent}
                slug={`${project.slug || project.id}-readme`}
              />
            </ExpandableCardContent>
          </div>
        </section>
      )}
    </article>
  );
}

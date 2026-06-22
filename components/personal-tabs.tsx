"use client"
import { portfolioData } from "@/lib/site-content";
import { ExperienceComponent } from "./personal-tabs/experience-section";
import { PerspectivesComponent } from "./personal-tabs/perspective-section";
import { SkillsComponent } from "./personal-tabs/skill-section";
import { StoryComponent } from "./personal-tabs/story-section";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Image from "next/image";

// ====== Updated menu types ======
type PersonalMenuItemId =
  | "story"
  | "experience"
  | "skills"
  | "perspectives"

type PersonalMenuItem = {
  label: string
  iconPath: string
  content: React.ReactNode
}

// ===== Types (matching the proposed schema) =====
export interface ContentBlock { label: string; content: string | string[] }
export interface TimelineItem { title: string; subtitle: string; period?: string; description?: string; details?: string[] }
export interface TagGroup { category?: string; items: string[] }

export interface StorySection { about: ContentBlock[]; timeline?: TimelineItem[] }
export interface ExperienceSection { roles: TimelineItem[]; resumeUrl: string }
export interface SkillsSection {
  tagGroups: TagGroup[]
  specifics?: Record<string, string[]>
  education: TimelineItem[]
  certifications: { name: string; issuer?: string; year?: string }[]
}
export interface PerspectivesSection {
  entries: { title: string; summary?: string; body: string; topics?: string[]; updatedAt?: string }[]
}

// ====== Updated menu items using new components ======
const personalMenuItems: Record<PersonalMenuItemId, PersonalMenuItem> = {
  story: {
    label: "My Story",
    iconPath: "icons/user.svg",
    content: <StoryComponent data={portfolioData.story} />,
  },
  experience: {
    label: "Experience",
    iconPath: "icons/briefcase.svg",
    content: <ExperienceComponent data={portfolioData.experience} />,
  },
  skills: {
    label: "Skills & Education",
    iconPath: "icons/education.svg",
    content: <SkillsComponent data={portfolioData.skills} />,
  },
  perspectives: {
    label: "Perspectives",
    iconPath: "icons/brain.svg",
    content: <PerspectivesComponent data={portfolioData.perspectives} />,
  },
}

// ====== Updated order ======
const menuOrder: PersonalMenuItemId[] = [
  "story",
  "experience",
  "skills",
  "perspectives",
]

// ====== Tabs component ======
const PersonalTabs = () => {
  const [activeSection, setActiveSection] = useState<PersonalMenuItemId | null>(null)

  return (
    <div>
      <div className="mb-8 border-b border-border">
        <div className="flex items-center justify-between">
          <nav
            className="flex gap-6 overflow-x-auto"
            aria-label="Portfolio sections"
          >
            {menuOrder.map((id) => {
              const item = personalMenuItems[id]
              return (
                <button
                  key={id}
                  onClick={() =>
                    setActiveSection(activeSection === id ? null : id)
                  }
                  className={cn(
                    "whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors",
                    activeSection === id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Image
                    src={`${item.iconPath}`}
                    alt={`${item.label} icon`}
                    width={16}
                    height={16}
                    className="inline-block mr-2 mb-1 dark:invert"
                  />
                  {item.label}
                </button>
              )
            })}
          </nav>
          {activeSection && (
            <button
              onClick={() => setActiveSection(null)}
              className="ml-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close tab"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {activeSection && <>{personalMenuItems[activeSection].content}</>}
    </div>
  )
}

export default PersonalTabs






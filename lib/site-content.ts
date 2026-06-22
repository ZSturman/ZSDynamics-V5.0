// ===== Reusable primitives =====
export interface ContentBlock {
  label: string
  content: string | string[]
}

export interface TagGroup {
  category?: string
  items: string[]
}

export interface TimelineItem {
  title: string
  subtitle: string
  period?: string
  description?: string
  details?: string[]
}

// ===== Section models =====

// 1) Story/history and motivations
export interface StorySection {
  about: ContentBlock[]              // long-form narrative blocks
  timeline?: TimelineItem[]          // optional life/community milestones
}

// 2) Resume-like experience + download link
export interface ExperienceSection {
  roles: TimelineItem[]              // jobs, contracting, internships
  resumeUrl: string                  // downloadable PDF
}

// 3) Skills with specifics + education + certifications
export interface SkillsSection {
  tagGroups: TagGroup[]              // high-level skill categories
  specifics?: Record<string, string[]> // deeper per-area bullets
  education: TimelineItem[]          // schools, programs, degrees
  certifications: { name: string; issuer?: string; year?: string }[]
}

// 4) Perspectives/opinions, freely extensible
export interface PerspectivesSection {
  entries: {
    title: string
    summary?: string
    body: string
    topics?: string[]
    updatedAt?: string               // ISO date string
  }[]
}

// ===== Portfolio root =====
export interface Portfolio {
  story: StorySection
  experience: ExperienceSection
  skills: SkillsSection
  perspectives: PerspectivesSection
}

// ===== Your data migrated =====
export const portfolioData: Portfolio = {
  story: {
    about: [
      {
        label: "Quick Summary",
        content:
          "Originally trained in the entertainment industry, I pivoted to software engineering by teaching myself through building projects I'd want to use. My background in film and storytelling gives me a different lens on design and flow: what connects one moment to the next, what holds attention, what breaks it."
      },
      {
        label: "Interests & Hobbies",
        content: [
          "Film & storytelling",
          "3D animation & modeling",
          "Physics & Quantum Mechanics",
          "Data visualization"
        ]
      }
    ],
    timeline: [
      {
        title: "Denver Dumb Friends League",
        subtitle: "Volunteer",
        description: "Supporting animal welfare and rescue operations"
      },
      {
        title: "Big Cat Rescue",
        subtitle: "Supporter",
        description: "Contributing to wildlife conservation efforts"
      },
      {
        title: "Cocoa Beach Cleanup",
        subtitle: "Participant",
        description: "Regular beach cleanup and environmental conservation"
      }
    ]
  },

experience: {
  roles: [
    {
      title: "Data Engineer (Contract)",
      subtitle: "TowardBetter.me — Remote",
      period: "Oct 2024 – Feb 2025",
      details: [
        "Designed and implemented data architecture to support app development for efficient storage and retrieval of user-generated content",
        "Built and optimized API endpoints using FastAPI with Firebase for authentication and database operations",
        "Used XState to build state-driven pipeline workflows for robust and maintainable data flows",
        "Developed and integrated an LLM-powered chat assistant for free-tier users to improve engagement and accessibility",
        "Integrated Twilio, Stripe, and Zoom to expand application functionality"
      ]
    },
    {
      title: "Full Stack Software Engineer",
      subtitle: "Lost & Hound — University of Melbourne, Australia",
      period: "Feb 2024 – Oct 2024",
      details: [
        "Built a Python-based data pipeline using OpenCV and scikit-learn for computer vision tasks",
        "Implemented PostgreSQL schema for large-scale image data with optimized queries",
        "Trained and deployed ML models for lost pet photo matching end to end",
        "Delivered training enabling non-profit teams to manage and maintain applications",
        "Improved build and deployment with GitHub Actions"
      ]
    },
    {
      title: "Web Engineer",
      subtitle: "theKnifeGrinder — Anchorage, Alaska",
      period: "Aug 2020 – Nov 2023",
      details: [
        "Modernized site infrastructure with React and Next.js to improve performance and UX",
        "Developed RESTful APIs with FastAPI for efficient data delivery",
        "Used Pandas and NumPy for data cleaning and transformation to support analytics"
      ]
    },
    {
      title: "Business Intelligence Engineer",
      subtitle: "Ameristar Casino — Denver, CO",
      period: "Apr 2017 – Oct 2023",
      details: [
        "Performed advanced data analysis with Pandas and Matplotlib to generate insights",
        "Built machine learning models in Python for segmentation and trend prediction",
        "Developed scalable backend systems for high-frequency ingestion and real-time analytics"
      ]
    }
  ],
  resumeUrl: "/Zachary Sturman Resume.pdf"
},

  skills: {
tagGroups: [
  {
    category: "Technical & Development",
    items: [
      "React",
      "TypeScript",
      "Node.js",
      "Python",
      "AWS",
      "React + Vite",
      "Design systems",
      "Node.js APIs",
      "Data modeling",
      "CI/CD",
    ],
  },
  {
    category: "Design & Visualization",
    items: [
      "Figma",
      "Adobe Creative Suite",
      "Blender",
      "UI/UX Design",
      "Data visualization",
    ],
  },
  {
    category: "Cloud & Systems",
    items: [
      "AWS IAM/S3/Lambda",
      "System Architecture",
      "Scalable backend design",
      "Infrastructure automation",
      "Monitoring & logging",
    ],
  },
],
    education: [
      {
        title: "B.S. in Media Communication",
        subtitle: "Full Sail University",
        period: "2014"
      }
    ],
    certifications: [
      { name: "Google Certified Data Analyst", issuer: "Google", year: "2022" },
      { name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", year: "2023" }
    ]
  },

  perspectives: {
    entries: []
  }
}
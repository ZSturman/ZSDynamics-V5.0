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
  engagement?: string                // e.g. "Contract", "Client project"
  technologies?: string[]
  projectSlug?: string               // related portfolio project
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
  otherRoles?: TimelineItem[]        // non-technical work shown compactly
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
  // Source: the public general résumé (public/Zachary Sturman Resume.pdf,
  // April 2026). Engagement labels are copied from it; do not upgrade a
  // client project, contract, or collaboration to salaried employment.
  roles: [
    {
      title: "AI Software Engineer, Web Platform",
      subtitle: "The Wolf Project — Remote",
      period: "Mar 2026 – Present",
      engagement: "Nonprofit web platform",
      projectSlug: "the-wolf-project",
      technologies: ["React", "Next.js", "Firebase Auth", "Firestore", "Cloudinary", "Shopify", "Zeffy"],
      details: [
        "Architect and build a full-stack nonprofit web platform with React, Firebase Auth, Firestore, and a responsive UI to support fundraising, content, and user workflows.",
        "Integrate Zeffy donation tracking, Shopify contribution flows, Cloudinary media management, and Firebase backend services for user access and content operations.",
      ],
    },
    {
      title: "Full-Stack Software Engineer",
      subtitle: "Production Scheduling Desktop App",
      period: "Dec 2024 – Jul 2025",
      engagement: "Client project",
      projectSlug: "google-sheets-production-schedule-desktop-app",
      technologies: ["React", "Tailwind CSS", "Firebase Auth", "Firestore", "Google Sheets"],
      details: [
        "Built a cross-platform scheduling application with React, Tailwind CSS, Firebase Auth, Firestore, and Google Sheets as the system of record for centralized production scheduling.",
        "Implemented multi-user access control, synchronized state, role-based permissions, timeline and table views, error handling, and predictable sync behavior for daily operations.",
      ],
    },
    {
      title: "Full-Stack Software Engineer",
      subtitle: "TowardBetter.me — Remote",
      period: "Oct 2024 – Feb 2025",
      engagement: "Contract",
      projectSlug: "towardbetterme-announcement-page",
      technologies: ["React", "Next.js", "Firebase Firestore"],
      details: [
        "Designed and built a functional prototype and public announcement site with React, Next.js, Firestore, form handling, client-side validation, local persistence, and state management.",
        "Translated early-stage product goals into deployable web architecture, structured data models, and maintainable implementation plans.",
      ],
    },
    {
      title: "Mobile Software Engineer, AI/ML Integration",
      subtitle: "Lost & Hound",
      period: "Feb 2024 – Oct 2024",
      engagement: "University of Melbourne collaboration",
      projectSlug: "lost-and-hound",
      technologies: ["React Native", "Python", "OpenCV", "PostgreSQL"],
      details: [
        "Built and maintained a React Native mobile assistance app, focusing on frontend architecture, performance, usability, and maintainable components.",
        "Integrated a Python computer-vision pipeline using OpenCV and ML tooling with PostgreSQL-backed storage for structured application data.",
      ],
    },
    {
      title: "Business Intelligence Engineer",
      subtitle: "Ameristar Casino — Denver, CO",
      period: "Apr 2017 – Oct 2023",
      engagement: "Employment",
      technologies: ["Python", "Pandas", "NumPy", "Matplotlib", "React"],
      details: [
        "Built analytics dashboards and reporting workflows combining React-based UI with Python, Pandas, NumPy, and Matplotlib analysis pipelines.",
        "Turned operational questions into repeatable reporting tools and visualizations supporting table-games analytics.",
      ],
    },
  ],
  otherRoles: [
    {
      title: "Casino Dealer",
      subtitle: "Snoqualmie Casino + Ameristar Casino — Seattle, WA / Denver, CO",
      period: "Apr 2017 – Present",
      engagement: "Employment",
      details: [
        "High-volume table operations requiring accuracy, risk awareness, and real-time customer communication.",
      ],
    },
  ],
  resumeUrl: "/Zachary Sturman Resume.pdf"
},

  skills: {
tagGroups: [
  { category: "Languages", items: ["Python", "TypeScript", "JavaScript", "SQL", "Swift", "Rust"] },
  { category: "Frontend & apps", items: ["React", "Next.js", "React Native", "Tailwind CSS", "SwiftUI", "Redux", "XState"] },
  { category: "Backend & cloud", items: ["FastAPI", "REST APIs", "Firebase Auth", "Firestore", "PostgreSQL", "Redis", "AWS", "Docker", "GitHub Actions"] },
  { category: "AI, data & testing", items: ["PyTorch", "TensorFlow", "scikit-learn", "Pandas", "NumPy", "OpenCV", "Pytest", "Playwright", "Cypress", "Postman"] },
  { category: "Hardware", items: ["ESP32", "PlatformIO", "Raspberry Pi", "I2C sensors & displays", "3D printing"] },
],
    education: [
      {
        title: "Mathematics coursework (in progress)",
        subtitle: "Seattle Central College",
        period: "Current",
        description: "Building the math foundation for a longer-term interest in physics and scientific computing.",
      },
      {
        title: "B.S. in Media Communication",
        subtitle: "Full Sail University",
        period: "2014"
      }
    ],
    certifications: [
      { name: "Google Data Analytics Certificate", issuer: "Google", year: "2022" },
      { name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", year: "2023" }
    ]
  },

  perspectives: {
    entries: []
  }
}
// ===== Professional presentation =====
// Single source for the homepage introduction, About, Experience and Résumé
// pages. Facts come from the public résumé, published project records, and
// the owner's own brief; open questions are listed in docs/CONTENT_REVIEW.md.

export const profile = {
  name: "Zachary Sturman",
  headline: ["Software Engineering", "Automation", "AI & Data", "Hardware Prototyping"],
  intro:
    "I build software and connected systems, from Python automation and native Apple apps to infrastructure tools and ESP32 prototypes.",
  background:
    "My background combines software development, data analytics, and media production. I'm studying mathematics at Seattle Central College and working toward a deeper understanding of physics and engineering.",
  location: "Based near Seattle, Washington",
  opportunities: "Open to software, research, and technical engineering opportunities.",
  statement:
    "I think a lot about how design influences trust, and how AI can support human judgment instead of replacing it.",
  email: "zasturman@gmail.com",
  resumeUrl: portfolioData.experience.resumeUrl,
  resumeFileName: "Zachary Sturman Resume.pdf",
} as const

export interface ProseSection {
  heading: string
  paragraphs: string[]
  links?: { label: string; href: string }[]
}

export const aboutSections: ProseSection[] = [
  {
    heading: "Where I started",
    paragraphs: [
      "I came to software from media. My degree is in Media Communication from Full Sail University, and my early work was in film, acting, and storytelling. That background still shapes how I build: I pay attention to what connects one moment to the next, what holds attention, and what quietly breaks someone's trust in a tool.",
    ],
  },
  {
    heading: "Moving into software and data",
    paragraphs: [
      "I taught myself to program by building things I wanted to use. Over six years as a business intelligence engineer at Ameristar Casino I turned operational questions into repeatable Python reports and dashboards with Pandas, NumPy, and Matplotlib.",
      "Since then I've worked on a computer-vision pipeline for Lost & Hound with a University of Melbourne team, contract and client web applications, and a nonprofit web platform for The Wolf Project. Alongside that work I build and release my own apps and tools.",
    ],
    links: [{ label: "Experience", href: "/experience" }],
  },
  {
    heading: "What I build now",
    paragraphs: [
      "Most of my current work is in three areas: Python automation that keeps systems in sync (this site publishes itself daily from my project workspace and Notion), native Apple apps built with SwiftUI and tested on real devices, and small AI and data experiments where I try to stay honest about what a model actually shows.",
    ],
    links: [{ label: "Selected work", href: "/#selected-work" }],
  },
  {
    heading: "Hands-on electronics",
    paragraphs: [
      "I like problems that leave the screen. I've built an ESP32 controller with a rotary encoder and OLED for my room lights, run Linux services on a Raspberry Pi 5, and prototyped on breadboards with sensors, cameras, a multimeter, an oscilloscope, a soldering iron, and a 3D printer. These are personal projects, not professional hardware engineering, but they're where I learn how software meets the physical world.",
    ],
    links: [{ label: "Hardware & electronics", href: "/explore/hardware" }],
  },
  {
    heading: "Studying math, aiming at physics",
    paragraphs: [
      "I'm currently taking mathematics courses at Seattle Central College. The longer-term goal is physics and scientific computing, the kind of work where simulation, measurement, and careful reasoning have to agree. Projects like Mass and Time are where I practice that on my own terms.",
    ],
  },
  {
    heading: "How I learn",
    paragraphs: [
      "I learn by building a small working version, testing it against something real, and writing down what broke. Work logs and articles on this site are part of that habit: they show the development history, including the parts that didn't work the first time.",
    ],
    links: [
      { label: "Writing", href: "/articles" },
      { label: "Work logs", href: "/work-logs" },
    ],
  },
]

export interface WorkPrinciple {
  title: string
  body: string
  examples: { label: string; href: string }[]
}

export const howIWork: WorkPrinciple[] = [
  {
    title: "Understand the problem first",
    body: "I start with the failure people actually feel. Recallable began with flashcard apps that turn into an overdue backlog, so its scheduler treats the queue as an ordering, never a debt.",
    examples: [{ label: "Recallable", href: "/projects/recallable" }],
  },
  {
    title: "Build small, then test the assumption",
    body: "Research projects start as runnable prototypes with an explicit question. Mass and Time keeps simulation output separate from interpretation; Train of Thought Agent tests whether memory becomes more useful when it starts from place.",
    examples: [
      { label: "Mass and Time", href: "/projects/mass-and-time" },
      { label: "Train of Thought Agent", href: "/projects/train-of-thought-agent" },
    ],
  },
  {
    title: "Make failures visible",
    body: "Reliability is designed in. Recallable's scheduling logic lives in a unit-tested package with UI tests on physical devices; the Hue controller shows its own Wi-Fi, bridge, and I2C diagnostics on its screen; this site checks its live deployment in a browser before it emails a report.",
    examples: [
      { label: "Hue Light Control", href: "/projects/hue-light-control" },
      { label: "How this site publishes itself", href: "/articles/how-i-sync-my-portfolio-using-notion" },
    ],
  },
  {
    title: "Connect disciplines",
    body: "Film taught me pacing and clarity, data work taught me to distrust a chart until I know where it came from, and math and electronics keep me close to how things actually behave. Most of my projects sit where two of those meet.",
    examples: [
      { label: "ChewSense", href: "/projects/chewsense" },
      { label: "About me", href: "/about" },
    ],
  },
]

/** Equipment and methods the owner has personally used (owner-provided). */
export const hardwareCapabilities: TagGroup[] = [
  { category: "Boards & platforms", items: ["ESP32", "Raspberry Pi 5", "PlatformIO", "Linux services"] },
  { category: "Bench & fabrication", items: ["Breadboard prototyping", "Soldering", "Multimeter", "Oscilloscope", "3D printing"] },
  { category: "Inputs & outputs", items: ["Sensors", "Cameras", "Rotary encoders", "I2C OLED displays"] },
]

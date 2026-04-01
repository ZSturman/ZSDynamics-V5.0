
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { trackResumeDownload } from "@/lib/firebase-analytics"
import { ExperienceSection } from "../personal-tabs"

interface ExperienceSectionProps {
  data: ExperienceSection
}

export function ExperienceComponent({ data }: ExperienceSectionProps) {
  return (
    <section>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-6">

          <Button
            variant="outline"
            className="bg-transparent  dark:text-white hover:bg-white hover:text-[#0f1419]  transition-colors w-fit"
            asChild
          >
            <a
              href={data.resumeUrl}
              download
              onClick={() => {
                trackResumeDownload(data.resumeUrl)
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Resume
            </a>
          </Button>
        </div>

        <div className="space-y-12">
          {data.roles.map((role, idx) => (
            <div
              key={idx}
              className="border-l-2 border-gray-700 pl-8 pb-8 relative hover:border-white transition-colors"
            >
              <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white rounded-full" />

              <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 gap-2">
                <div>
                  <h3 className="text-2xl font-bold mb-1">{role.title}</h3>
                  <p className="text-gray-400 text-lg">{role.subtitle}</p>
                </div>
                {role.period && (
                  <span className="text-gray-500 text-sm md:text-base whitespace-nowrap">{role.period}</span>
                )}
              </div>

              {role.description && <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">{role.description}</p>}

              {role.details && role.details.length > 0 && (
                <ul className="space-y-2">
                  {role.details.map((detail, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                      <span className="dark:text-white mt-1">→</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

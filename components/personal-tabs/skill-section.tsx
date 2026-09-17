
import { Badge } from "@/components/ui/badge"
import { SkillsSection } from "../personal-tabs"



interface SkillsSectionProps {
  data: SkillsSection
}

export function SkillsComponent({ data }: SkillsSectionProps) {
  return (
    <section className="px-8 md:px-16">
      <div className="mx-auto">


        {/* Tag Groups */}
        <div className="mb-16 space-y-8">
          {data.tagGroups.map((group, idx) => (
            <div key={idx}>
              {group.category && <h3 className="text-lg font-semibold mb-4 ">{group.category}</h3>}
              <div className="flex flex-wrap gap-2">
                {group.items.map((item, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className=" hover:bg-gray-200 px-4 py-2 text-sm"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>


        {/* Education & Certifications */}
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-bold mb-6">Education</h3>
            <div className="space-y-6">
              {data.education.map((edu, idx) => (
                <div key={idx} className="border-l-4 border-gray-900 pl-4">
                  <h4 className="font-semibold text-lg">{edu.title}</h4>
                                    <div className="flex items-center gap-2 mt-1 text-sm opacity-70">
                    {<span>{edu.subtitle}</span>}
                    {edu.period && <span>•</span>}
                      {edu.period && <span className="text-sm opacity-70 mt-1">{edu.period}</span>}
                  </div>


                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-6">Certifications</h3>
            <div className="space-y-4">
              {data.certifications.map((cert, idx) => (
             <div key={idx} className="border-l-4 border-gray-900 pl-4">
                  <h4 className="font-semibold">{cert.name}</h4>
                  <div className="flex items-center gap-2 mt-1 text-sm opacity-70">
                    {cert.issuer && <span>{cert.issuer}</span>}
                    {cert.issuer && cert.year && <span>•</span>}
                    {cert.year && <span>{cert.year}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { StorySection } from "../personal-tabs"


interface StorySectionProps {
  data: StorySection
}

export function StoryComponent({ data }: StorySectionProps) {
  return (
    <section >
      <div className="max-w-6xl mx-auto">


        <div className="grid md:grid-cols-2 gap-12 mb-20">
          {data.about.map((block, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className="text-xl font-semibold dark:text-[#4a9eff] text-[#244468] uppercase tracking-wide">{block.label}</h3>
              {Array.isArray(block.content) ? (
                <ul className="space-y-2 dark:text-gray-300 leading-relaxed">
                  {block.content.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-[#4a9eff] mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dark:text-gray-300 text-lg leading-relaxed">{block.content}</p>
              )}
            </div>
          ))}
        </div>

        {data.timeline && data.timeline.length > 0 && (
          <div>
            <h3 className="text-xl dark:text-[#4a9eff] text-[#244468]  font-semibold uppercase tracking-wide  mb-8">Volunteer Work</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {data.timeline.map((item, idx) => (
                <div
                  key={idx}
                  className="dark:bg-[#242938] p-6 rounded-lg border border-[#2d3548] hover:border-[#4a9eff] transition-colors"
                >
                  <h4 className="text-xl font-semibold mb-2">{item.title}</h4>
                  <p className="dark:text-[#4a9eff] text-[#244468] text-sm mb-3">{item.subtitle}</p>
                  {item.description && <p className="dark:text-gray-400 text-gray700 text-sm leading-relaxed">{item.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

"use client"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import { PerspectivesSection } from "../personal-tabs"

interface PerspectivesSectionProps {
  data: PerspectivesSection
}

export function PerspectivesComponent({ data }: PerspectivesSectionProps) {
  const [activeTab, setActiveTab] = useState("0")

  if (data.entries.length === 0) {
    return (
      <section>
        <div className="max-w-4xl mx-auto text-center py-20 ">
          <h1 className="text-center text-3xl mb-5">Nothing here yet. </h1>
          <p className="text-center">
            I&apos;m working on adding more content to this section. Please check back later!
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="">
      <div className="max-w-4xl mx-auto">


        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start mb-8  border border-gray-200 p-1 h-auto flex-wrap">
            {data.entries.map((entry, idx) => (
              <TabsTrigger
                key={idx}
                value={idx.toString()}
                className=" px-4 py-2 text-sm"
              >
                {entry.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {data.entries.map((entry, idx) => (
            <TabsContent
              key={idx}
              value={idx.toString()}
              className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
            >
              <article className=" p-8 rounded-lg border border-gray-200 shadow-lg">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold mb-2 text-balance">{entry.title}</h3>
                  {entry.summary && <p className=" italic">{entry.summary}</p>}
                </div>

                <p className=" leading-relaxed mb-6 text-pretty">{entry.body}</p>

                <div className="flex flex-wrap items-center gap-3">
                  {entry.topics && entry.topics.length > 0 && (
                    <>
                      {entry.topics.map((topic, i) => (
                        <Badge key={i} variant="outline" className="border-gray-300 ">
                          {topic}
                        </Badge>
                      ))}
                    </>
                  )}
                  {entry.updatedAt && (
                    <span className="text-xs  ml-auto">
                      Updated {new Date(entry.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </article>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}

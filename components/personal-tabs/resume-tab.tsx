// import React from 'react'
// import { Button } from '../ui/button'
// import { Download } from 'lucide-react'
// import { personalTabsData } from '@/lib/site-content'

// const ResumeTab = () => {

//   const data = personalTabsData.resume

//   return (
//     <div className="space-y-6">
//       <div>
//         <h3 className="mb-2 text-sm font-medium text-muted-foreground">Summary</h3>
//         <p className="leading-relaxed">{data.summary}</p>
//       </div>

//       <div>
//         <h3 className="mb-3 text-sm font-medium text-muted-foreground">Skills & Knowledge</h3>
//         <div className="space-y-4">
//           {data.skills.map((skillGroup) => (
//             <div key={skillGroup.category}>
//               <h4 className="mb-2 text-sm font-medium">{skillGroup.category}</h4>
//               <div className="flex flex-wrap gap-2">
//                 {skillGroup.items.map((skill) => (
//                   <span key={skill} className="rounded-md bg-secondary px-2.5 py-1 text-sm text-secondary-foreground">
//                     {skill}
//                   </span>
//                 ))}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       {data.downloadUrl && (
//         <Button size="sm" className="gap-2">
//           <Download className="h-4 w-4" />
//           Download Full Resume
//         </Button>
//       )}
//     </div>
//   )
// }

// export default ResumeTab
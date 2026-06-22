// import React from 'react'

// const EducationTab = () => {
//   const data = {
//     degrees: [
//       {
//         degree: "Bachelor of Science in Computer Science",
//         institution: "State University",
//         year: "2020"
//       },
//       {
//         degree: "Master of Science in Software Engineering",
//         institution: "Tech Institute",
//         year: "2022"
//       }
//     ],
//     certificates: [
//       "Certified Kubernetes Administrator (CKA)",
//       "AWS Certified Solutions Architect – Associate",
//       "Certified ScrumMaster (CSM)"
//     ]
//   }
//   return (
//     <div className="space-y-6">
//       <div>
//         <h3 className="mb-3 text-sm font-medium text-muted-foreground">Degrees</h3>
//         <div className="space-y-3">
//           {data.degrees.map((degree) => (
//             <div key={degree.degree}>
//               <div className="font-medium">{degree.degree}</div>
//               <div className="text-sm text-muted-foreground">
//                 {degree.institution} • {degree.year}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div>
//         <h3 className="mb-3 text-sm font-medium text-muted-foreground">Certificates</h3>
//         <ul className="space-y-1">
//           {data.certificates.map((cert) => (
//             <li key={cert} className="text-sm leading-relaxed">
//               • {cert}
//             </li>
//           ))}
//         </ul>
//       </div>
//     </div>
//   )
// }

// export default EducationTab
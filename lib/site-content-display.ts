export const displayDateLabel: (
  projectStatus: string | undefined,
  sortField: "title" | "createdAt" | "updatedAt",
  projectPhase?: string
) => string = (projectStatus, sortField, projectPhase) => {
  if (sortField == "createdAt") {
    return "Started";
  }

  // Normalize for further checks
  const status = projectStatus?.toLowerCase();
  const phase = projectPhase?.toLowerCase();

  if (phase === "archive" || phase === "archived") {
    return "Archived";
  }

  if (status === "abandoned") {
    return "Abandoned";
  }

  if (phase === "published") {
    return "Published";
  }

  if (phase === "released") {
    return "Released";
  }

  if (phase == "live") {
    return "Last Updated";
  }

  if (status == "in progress") {
    if (phase == "developing") {
           return "Last Updated";
    }
  }

  return "Last Updated";
};

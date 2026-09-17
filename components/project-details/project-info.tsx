import { formatDate } from "@/lib/utils";
import { Project } from "@/types";

// Reusable Project Info Component
export default function ProjectInfo({ project }: { project: Project }) {
  return (
    <div className="space-y-6 p-6 bg-muted/30 rounded-lg">
      <div className="space-y-4">
        
        <InfoItem label="Started" value={formatDate(project.createdAt)} />
        <InfoItem label="Last Updated" value={formatDate(project.updatedAt)} />
        {project.category && (
          <InfoItem label="Category" value={project.category} />
        )}
      </div>

      {project.details && project.details.length > 0 && (
        <>
          <div className="border-t border-border pt-2">
            {project.details.map((detail, index) => (
              <InfoItem key={index} label={detail.label} value={detail.value} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | string[] | Record<string, unknown> | null
}) {
  let displayValue: string;

  if (!value) return null

  if (Array.isArray(value)) {
    displayValue = value.join(", ");
  } else if (value && typeof value === "object") {
    try {
      displayValue = JSON.stringify(value);
    } catch {
      displayValue = String(value);
    }
  } else {
    displayValue = String(value ?? "");
  }

  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <span className="text-sm text-foreground text-right">{displayValue}</span>
    </div>
  );
}

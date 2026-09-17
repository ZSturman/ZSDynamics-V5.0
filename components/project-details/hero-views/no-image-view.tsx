import { Project } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NoImageHeroImage({ project }: { project: Project }) {
  // No image to display - the header already shows title/summary
  return null;
}

import Studio from "@/components/studio";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <Studio initialRoute={{ view: "studio", projectId, tab: "clips" }} />;
}

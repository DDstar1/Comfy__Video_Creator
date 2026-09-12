export type StudioRoute = { view: "projects" | "studio" | "library"; projectId?: string; tab?: "story" | "references" | "clips" };

export function studioUrl(route: StudioRoute) {
  if (route.view === "library") return "/studio/library";
  if (route.view === "projects") return "/studio";
  return `/studio/projects/${encodeURIComponent(route.projectId ?? "")}?tab=${route.tab ?? "clips"}`;
}

export function readStudioRoute(url: URL): StudioRoute {
  const legacy = url.hash.replace(/^#\/?/, "").split("/");
  const parts = url.pathname.split("/").filter(Boolean);
  if (legacy[0] === "projects") return { view: "projects" };
  if (legacy[0] === "library" || parts[1] === "library") return { view: "library" };
  const projectId = legacy[0] === "project" ? legacy[1] : parts[1] === "projects" ? parts[2] : undefined;
  if (!projectId) return { view: "projects" };
  const tab = legacy[0] === "project" ? legacy[2] : url.searchParams.get("tab");
  try {
    return { view: "studio", projectId: decodeURIComponent(projectId),
      tab: tab === "story" || tab === "references" ? tab : "clips" };
  } catch { return { view: "projects" }; }
}

# ComfyTR frontend plan

## Screens and flow

Projects → Story → References → Clips → Generate / revise → Validate → Continue.

- Projects: searchable drafts and scene/idea project creation.
- Story: source text, reference @mentions, aspect ratio, visual direction.
- References: account-wide public image library, upload, search, project selection.
- Clips: readable storyboard cards and a focused revision panel. H3 prompts stay hidden.
- Validation: confirm approval, require a real video, lock the accepted clip.

## Visual direction

Ivory workspace, white surfaces, ink text, olive actions, subtle ochre accents.
Permanent desktop navigation, cinematic landscape imagery, editorial serif story
titles, Geist interface text, and Lucide icons. The UI/UX skill's verified Flat
Design web-app guidance informs hierarchy, progressive disclosure and restrained
effects. The palette is a project-specific adaptation.

## Interaction and accessibility

Responsive sidebar; native dialogs with focus management; labelled forms; keyboard
navigation; drag/drop plus file picker; search/filter and empty/loading/error states;
visible focus and reduced motion. Persist edits before reporting them saved.
Treat readable edits and change requests as pending AI revisions. Never represent
a reference still or sample as a generated video.

## Integration boundaries

Supabase Auth and public Storage use the linked project's public browser key.
Image metadata uses `comfyTR_reference_images` and existing RLS. Project/story/clip
drafts persist locally, scoped by account. AI planning and H3 compilation use the
server-side Luna Responses endpoint and uploaded H3 Director skill. Rendering,
executable workflow assembly, RunPod submission, polling and video storage are connected. Sample content
is labelled. Remote project/clip persistence and server-side validation enforcement
remain a subsequent backend integration.

## Verification

Production build, lint, model tests for clip locking, browser checks of creation,
persistence, references, editing, dialogs, search and mobile layouts. Live upload
requires an authenticated account; do not create test accounts automatically.

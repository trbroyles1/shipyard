# High-Level UI Specification

## General Principles
- Dark mode throughout. No light theme required at launch.
- No full page reloads or navigations. All view transitions happen client-side within a single shell.
- All panels and panes that subdivide the layout should be collapsible to maximize screen real estate as needed.
- Font pairing: a clean sans-serif display font (e.g. Outfit) for UI chrome and a monospace font (e.g. JetBrains Mono) for code, branches, commit SHAs, and file paths.
- Color language: cyan/sky blue as the primary accent. Green for success/approved/ready. Yellow for in-progress/warning. Red for failure/blocked/critical age. Orange for moderate age warning. Gray for unknown/pending/muted states.

## Top Bar
- Fixed height (~52px), full width, sits above all other content.
- Left side: app icon (anchor motif) and "Shipyard" wordmark with a gradient accent treatment.
- Right side: notification bell icon with unread indicator dot, user avatar/icon.
- Notification bell opens a dropdown panel (right-aligned, ~320px wide) listing recent notifications with title and relative timestamp. Scrollable if content exceeds max height.
- User icon opens a dropdown menu showing the authenticated user's display name and username, with menu items for "Preferences" and "Sign Out."

## MR List Sidebar (Left Panel)
- Default width ~340px, docked to the left edge below the top bar.
- **Collapsible**: a toggle control on the edge collapses the sidebar to zero width, giving the main content area the full viewport. A small affordance (chevron button) remains visible on the collapsed edge to re-expand it.
- **Filter tabs** at the top: a segmented control with three options:
  - "Mine" — MRs where the current user is the assignee (i.e., MRs I opened).
  - "To Review" — MRs where the current user is NOT the assignee (i.e., others' MRs I need to review).
  - "All Open" — union of both sets.
- **Sort control** below the filter tabs: displays the count of visible MRs and a toggle button cycling through sort modes (by age or by repo name, ascending or descending). Default: age ascending (oldest first).
- **MR cards** in a scrollable list below the controls. Each card contains:
  - **Title line**: `{repo-slug}: {MR title}`, with the repo slug highlighted in accent color. Clamped to 2 lines with ellipsis overflow.
  - **Status callout** (conditional): if the MR is a draft, show "Draft" in muted italic. If the MR is mergeable and not a draft, show "✓ Ready to merge" in green italic.
  - **Metadata row**: assignee username (linked to their GitLab profile), relative age, pipeline status dot (color-coded, pulsing animation if running), approval indicator (green/red dot with `given/required` count).
  - **Age-based background tinting**: card background shifts to a subtle orange tint when MR age exceeds a configurable "warning" threshold (default 10h), and to a subtle red tint when it exceeds a "critical" threshold (default 20h). These thresholds are user-configurable via Preferences.
- Card sizing: large enough to read comfortably but compact enough that 6–7 cards are visible simultaneously on an FHD (1920×1080) screen without scrolling. Roughly 80–90px per card height.
- Selected card state: accent-colored border with a subtle glow/highlight to clearly distinguish it from the rest of the list.

## Main Content Area (Right of Sidebar)
Occupies all remaining horizontal space. Composed of three vertical zones: the MR overview panel, the tab bar, and the tab content area.

### MR Overview Panel (Collapsible Pull-Down)
- Sits at the top of the main content area, below the top bar.
- **Collapsible**: clicking the header row toggles between expanded and collapsed states. Collapsed state shows only the header row (~40px). Expanded state reveals the full overview. Default: expanded when an MR is first selected.
- **Header row**: merge request icon, `!{iid} · {repo-slug}`, with a chevron indicating expand/collapse state.
- **Expanded content**:
  - MR title (large, prominent).
  - Branch indicator: `{source_branch} → {target_branch}` in monospace, accent-colored.
  - Description text with automatic JIRA ticket detection: any `PROJ-1234` style reference becomes a clickable link that opens an in-page popup with ticket details (not a navigation away). Description area has a max-height with internal scroll.
  - Label pills in a horizontal wrap row.
  - Conditional status pills: "Draft" (yellow) if applicable, "Conflicts" (red) if applicable.
  - Stats row: pipeline status (dot + label), approval count with check/X indicator, file change count, author with linked username.
  - **Action buttons row**:
    - "Approve" (green outline)
    - "Request Changes" (red outline)
    - "Merge" (primary filled accent) — disabled with "Not Mergeable" label when the MR is not mergeable.
    - "Open in GitLab" (neutral, right-aligned) — external link to the MR on GitLab.

### Tab Bar
- Horizontal tab strip directly below the overview panel.
- Tabs: **Changes** (with file count badge), **Commits** (with commit count badge), **Discussions** (with thread count badge), **Pipeline**, **History** (with event count badge).
- Active tab indicated by accent-colored text and bottom border.

### Tab Content: Changes
- Split into two sub-panels: file tree (left) and unified diff viewer (right).
- **File tree panel**:
  - ~220px wide, collapsible with its own toggle. When collapsed, a thin chevron affordance remains to re-expand.
  - Renders the changed files organized by directory structure (folders expand to show nested files).
  - Each file shows its name in monospace and `+additions / -deletions` stats.
  - Clicking a file smooth-scrolls the diff viewer to that file's section.
  - **Scroll-spy**: as the user scrolls through the diff viewer, the file tree highlights whichever file is currently at the top of the viewport.
- **Unified diff viewer** (scrollable, takes remaining width):
  - All changed files are rendered in a single vertically-scrollable area, stacked file by file. The user scrolls through all diffs continuously — no need to click between files one at a time.
  - Each file section has a **sticky header bar** at the top that pins while scrolling through that file's diff. The header shows: collapse/expand chevron, file icon, file path in monospace, and `+additions / -deletions` stats.
  - **Collapsible file sections**: clicking a file's header bar collapses its diff down to just the header, letting the user skip past files they don't need to review.
  - Diff lines are color-coded: green background tint for additions (with `+` prefix), red tint for deletions (with `-` prefix), neutral for context lines.
  - Line numbers displayed in a gutter column.
  - **Inline add-comment affordance**: a `+` icon appears on hover at the end of each diff line, indicating the user can start a new comment thread on that line.
  - **Inline comment threads**: existing discussion threads that are attached to specific file/line locations render directly in the diff, positioned beneath the relevant line. Each thread shows:
    - Sequence of notes with avatar, author name (linked to GitLab profile), relative timestamp, and body text.
    - "Resolved" badge on the thread if applicable.
    - Reply input at the bottom of the thread.
  - This means inline diff threads appear both here in the Changes view (in context) AND in the Discussions tab (as a consolidated list).

### Tab Content: Commits
- Scrollable list of commits in the MR.
- Each entry shows: commit SHA (truncated, monospace, accent-colored, linked to the commit on GitLab), commit message, author name (linked to GitLab profile), and relative timestamp.

### Tab Content: Discussions
- Scrollable list of all discussion threads on the MR, both file-specific and general.
- Each thread displayed as a card:
  - Header bar showing either the file path + line number (monospace, for file-level threads) or a "General Comment" tag (for MR-level threads).
  - "Resolved" badge if applicable.
  - Sequence of notes with avatars, linked author names, timestamps, and body text.
  - Reply input at the bottom of each thread.
- Below all threads: a general comment input for adding a new MR-level comment.

### Tab Content: Pipeline
- Pipeline header: pipeline icon, label, pipeline ID (monospace, accent-colored), status dot, and status label.
- **Stage visualization**: horizontal row of stage cards (build, test, lint, security, deploy, etc.) connected by horizontal line segments. Each stage card shows its name, a status dot, and duration. Clicking a stage selects it.
- **Job log viewer**: below the stages, a card showing the selected stage's log output. Header with status dot, stage name, and duration. Body is a monospace scrollable log area with line numbers. Log lines are color-coded: green for success messages, red for errors, yellow for warnings.

### Tab Content: History
- Vertical timeline of all events in the MR's lifecycle, sorted newest-first.
- A vertical line runs down the left side with color-coded dots at each event:
  - Cyan/accent: MR opened.
  - Green: approvals, thread resolutions.
  - Yellow: comments.
  - Gray: commits pushed.
  - Orange: pipeline events.
- Each event shows: linked user name (if applicable), event description, and relative timestamp.

## Toast Notifications
- Appear in the bottom-right corner of the viewport.
- Slide in from the right with animation.
- Contain an icon, title, and message body.
- Auto-dismiss after ~4 seconds.
- Distinct notification types with distinct audible cues (per original spec): single chime for new MR visible, double chime for MR assigned to me, distinct tone for MR ready to merge.

## JIRA Ticket Popup
- Triggered by clicking a JIRA ticket reference anywhere in the UI (MR descriptions, comments, etc.).
- Modal overlay with backdrop blur.
- Card showing ticket key, summary, and a grid of fields: status, priority, type, sprint, assignee, reporter, description.
- Dismissable by clicking the backdrop or close button.

## User Preferences Modal
- Accessed via the user menu in the top bar.
- Modal overlay with backdrop blur.
- Sections:
  - **Notifications**: toggles for sound effects, toast notifications, new MR alerts, assigned-to-me alerts, ready-to-merge alerts.
  - **MR Age Thresholds**: numeric inputs for the warning (orange) and critical (red) hour cutoffs that control card background tinting.
- Save button to apply and close.

## Empty State
- When no MR is selected, the main content area displays a centered, muted icon and text prompt: "Select a merge request to get started."

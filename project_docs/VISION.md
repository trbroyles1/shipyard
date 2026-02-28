## Shipyard Project - Vision Document

## High Level
I wish to construct a new project that will be a slick, dark-mode dashboard for handling MR reviews on GitLab. Think of a single pane of glass kind of deal. We'll call it "Shipyard".

From this dashboard, I wish to be able to manage and interact with all reviews that are visibe to me within the scope of a top-level group I specify.

## Feature Overview
Features should include:
- View and comment on merge requests
 - comment at either at the diff level or at the MR level itself
 - existing comment threads on MRs properly rendered and can be replied to
 - See the list of commits in the MR
- Request changes on MRs
- Approve MRs
- Merge MRs
- See MR build status, status check status, code scanner / linter / test statuses -- in a word, everything I can see about the MR through GitLab
- Drill into build pipelines associated to the MR and see details about pipeline jobs such as the stream of job output / logs
- The dashboard automatically update the statuses of all information, details, indicators, etc relative to the MR async, without ever needing to refresh / reload the page
- The dashboard should not require full browser refreshes / page loads to move from view to view.
- When a new MR visible to me is opened, toast notification and single audible chime
- When a new MR visible to me is opened and specifically assigned to me as a reviewer, toast notification and double audible chime.
- When an MR I opened becomes ready to merge (nothing blocking it from merging anymore - approvals, builds, tests, status checks and so forth) a toast notification and distinct audible cue.
- User preferences to allow controlling notifications settings among other things.
- Where GitLab user names appear, they link to the user's GitLab page / profile
- Where commit hashes appear, they link to the commit in GitLab
- When viewing details of an MR, if the title or description references a JIRA ticket, turn into a link that opens an in-page pop-up showing the ticket details.


In a word, I want to be able to see all information about an MR I could see through GitLab, and conduct all MR activities I could conduct through GitLab, through this dashboard. Recommend consulting GitLab docs as needed to see everything that is available and be sure to surface it. The one thing I do _not_ need to be able to do through this dashboard is actually open MRs; that will still be handled via GitLab's UI.

## Technical Requirements
- Build with Node/NextJS and AppRouter
- WebSockets or SSE where needed for server-initiated push messages
- Authenticates via GitLab, using it as an OAuth provider
- Build with a modular, component driven architecture on both front and back end, to make it easy to extend and modify. This includes keeping UI theming modular so that it is easy to build a new theme for it.
- Logging for both front end and back end: for the s*erver, write all to stdout. For the browser, write to the console. Standard logging levels from ERROR through DEBUG. **no structured logging / writing log messages as JSON objects**
- If at all possible, the app should avoid storing any durable state in non-ephemeral storage of any kind - databases, directory hierarchies and so forth. It is fine for the server to hold onto a minimal amount of state ephemerally if it needs to, but by and large it is acting only as a front end for GitLab MRs and so should not need to. The only real exception I can think of is the user's preferences, and those can be stored in a cookie for now.

## UI Ideas
Reference two sibling files of this vision as resources:
- `UI_SPEC.md` - high level UI specification
- `ship-mockup.jsx` - a mostly-full-featured mockup of the UI as a React component


## Remarks

Again, no page reloads / refreshes throughout the whole app. My primary motivation for this is that in GitLab I feel like it is clunky to have to navigate around between different projects and pages with lots of page reloads to manage MRs for all our different projects, and I'm looking for a slick single-pane-of-glass type interface to interact with them.

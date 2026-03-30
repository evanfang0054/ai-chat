# AI Chat Web UX Refresh Design

- Date: 2026-03-30
- Scope: `apps/web`
- Status: Draft approved for spec writing

## 1. Goal

Upgrade the current web app from a basic dark admin shell into a cohesive, product-grade workspace UI using Tailwind + shadcn/ui conventions. The refresh should improve readability, interaction clarity, and overall product polish without changing backend contracts or rewriting existing business flows.

The target outcome is a unified AI workspace experience across `login`, `chat`, `schedules`, `runs`, `dashboard`, `admin`, and the shared app shell.

## 2. Product Direction

### Chosen direction
- Visual direction: **Editorial Workspace**
- Theme strategy: **light + dark themes**, with **light as the default**
- Motion style: **restrained**, limited to essential hover, focus, loading, and panel transitions
- Rollout scope: **all existing web pages in the first batch**
- Design approach: **establish a system first, then refactor all pages onto it**

### Experience goals
The redesigned UI should feel:
- clear
- calm
- refined
- professional
- consistent across business surfaces

This is not meant to be a flashy experimental redesign. It should feel like a mature SaaS workspace that users can comfortably stay in for long sessions.

### Primary success criteria
1. Users can scan each page faster and understand hierarchy more easily.
2. Shared UI patterns feel consistent across all pages.
3. Chat, schedules, and runs feel like surfaces within one product rather than unrelated screens.
4. Loading, empty, error, and disabled states feel intentional instead of incidental.
5. The upgraded UI preserves current flows and remains straightforward to maintain.

## 3. Constraints and Non-Goals

### Constraints
- Keep existing frontend data flow and page responsibilities intact.
- Do not change backend API contracts.
- Do not introduce unnecessary abstraction or a heavy design-system architecture.
- Follow the repository’s KISS guidance.
- Prefer shadcn/ui structure and interaction semantics for the UI layer.

### Non-goals
- Rewriting business logic in stores or services.
- Expanding feature scope.
- Rebuilding routing or auth flow behavior.
- Adding animation-heavy interactions.
- Creating an over-engineered token system beyond what this project needs now.

## 4. Recommended Implementation Strategy

### Selected approach
Adopt **system-first redesign**:
1. define a lightweight visual and interaction system
2. align base UI components with shadcn/ui conventions
3. migrate page shells and high-value layouts onto the new system
4. refine state feedback and cross-page consistency

### Why this approach
This project needs a full-product upgrade, not isolated page polishing. A system-first pass creates consistency and prevents the common failure mode where individual pages improve visually but still behave and feel disconnected.

## 5. Visual System

### 5.1 Core aesthetic
The interface should resemble a refined editorial workspace:
- bright default canvas
- soft contrast surfaces
- strong reading comfort
- measured visual hierarchy
- restrained accents
- premium but low-noise composition

The visual language should feel closer to a carefully designed productivity product than to a generic admin panel.

### 5.2 Color model
Use semantic color tokens rather than page-specific values.

Core token groups:
- background: app background, elevated surface, muted surface
- foreground: primary text, secondary text, muted text
- border: subtle divider, active border, critical border
- accent: primary interactive accent, hover accent, focus ring
- status: success, warning, error, info

#### Light theme intent
- warm or neutral light workspace base
- gentle borders and panel separation
- strong text contrast without harsh black-on-white glare
- subtle accent usage for interactivity and product identity

#### Dark theme intent
- not a direct inversion of the light theme
- maintain the same semantic layering and readability rules
- preserve calmness and information clarity over dramatic neon styling

### 5.3 Typography
Typography should emphasize readability and product maturity.

Guidelines:
- use a refined body font suitable for long-form reading and dense UI
- use a distinct but restrained heading treatment
- clearly differentiate page titles, section headings, metadata, and helper text
- avoid overly compressed or futuristic display treatments

### 5.4 Shape, spacing, and depth
- Rounded corners should be consistent across buttons, inputs, cards, popovers, and dialogs.
- Shadows should remain light and supportive, especially in light theme.
- Borders should do most of the separation work, with shadows used sparingly.
- Vertical rhythm should be standardized for headers, sections, lists, and forms.
- Density should stay comfortable rather than dashboard-cramped.

## 6. Component System Strategy

## 6.1 Base component direction
The UI layer should move toward shadcn/ui-compatible patterns for structure and behavior, while staying pragmatic about what gets replaced.

Priority components:
- Button
- Input
- Textarea
- Card
- Badge
- Dialog
- DropdownMenu
- Tabs
- Sheet or Drawer
- Toast
- Skeleton
- Separator
- ScrollArea

### 6.2 Migration principle
Do not replace components mechanically just to say shadcn/ui is in use. Prefer the minimal path that achieves:
- consistent styling
- predictable interaction states
- shared semantics
- easier page composition

If a current component is simple and useful, it can be retained and restyled around shadcn/ui conventions.

### 6.3 Shared UI capabilities to introduce
Create a small shared layer for:
- page header blocks
- content width and section spacing
- toolbar/action rows
- empty state panels
- error state panels
- loading skeleton variants
- theme toggle entry point

These should support all current pages without creating a large framework.

## 7. Global Layout and Navigation

### 7.1 App shell
Current app shell is functional but visually flat. It should become a more stable product frame.

Target changes:
- stronger top navigation hierarchy
- clearer active nav treatment
- more deliberate brand area
- integrated user menu area
- unified page container rules
- support for global theme toggle and transient feedback

The shell should communicate that the user is inside one product workspace rather than a set of unrelated routes.

### 7.2 Page structure rules
All pages should follow a common structure:
1. page header
2. primary content region
3. optional secondary actions or side panels
4. clearly styled state surfaces

This consistency matters more than adding extra visual complexity.

## 8. Page-Level Design

### 8.1 Login
`apps/web/src/pages/login/LoginPage.tsx`

The login page should become a real product entry surface.

Target characteristics:
- clearer welcome framing
- more refined sign-in card
- stronger title and supporting copy hierarchy
- better input and submit feedback
- intentional error presentation
- visual continuity with the rest of the product

### 8.2 Chat
`apps/web/src/pages/chat/ChatPage.tsx`

This is the core experience and should receive the most attention.

Target structure:
1. page header with context and key actions
2. session navigation with stronger information hierarchy
3. message region with improved spacing and role distinction
4. better-integrated tool execution presentation
5. stable composer region with clearer submit/streaming states

Key improvements:
- richer empty state that feels like a welcome surface
- clearer current-session context
- more legible distinction between user and assistant content
- tool execution states that are easy to scan
- error feedback that does not break conversational context

### 8.3 Schedules
`apps/web/src/pages/schedules/SchedulesPage.tsx`

This page should evolve from a basic form/list combination into a more deliberate management surface.

Target characteristics:
- proper page heading and supporting explanation
- clearer action entry points for create/edit flows
- schedule rows with improved scanability
- stronger expression of enabled state and next run timing
- less visually fatiguing forms through better grouping and spacing

### 8.4 Runs
`apps/web/src/pages/runs/RunsPage.tsx`

This should feel like a record and outcome review surface.

Target characteristics:
- clearer status-first list design
- better grouping of metadata such as trigger time and related schedule
- stronger readability for success/failure outcomes
- optional richer expansion or detail treatment if current structure allows

### 8.5 Dashboard
`apps/web/src/pages/dashboard/DashboardPage.tsx`

The dashboard should align to the new visual system and stop feeling like a placeholder page.

Target characteristics:
- consistent page header
- stronger card and panel styling
- cleaner information grouping
- better empty or low-data presentation

### 8.6 Admin
`apps/web/src/pages/admin/AdminPage.tsx`

The admin page should inherit the same product language while remaining distinct as a privileged surface.

Target characteristics:
- clear page framing
- consistent controls and content panels
- strong but not loud distinction for sensitive/admin-only actions

## 9. Interaction and Feedback Rules

### 9.1 Motion
Motion should remain restrained and utility-focused.

Allowed motion categories:
- hover transitions
- focus transitions
- panel open/close transitions
- dropdown/dialog/sheet transitions
- lightweight loading transitions

Avoid:
- large entrance choreography
- decorative motion unrelated to task completion
- attention-stealing transitions during routine use

### 9.2 Loading states
Use consistent loading treatment across the app.

Rules:
- first-load page states use skeletons instead of blank gaps
- inline actions show local loading feedback
- loading should preserve layout stability where possible
- chat sending/streaming should show a controlled in-progress state

### 9.3 Empty states
Empty states should explain purpose and next steps.

Rules:
- chat empty state should feel welcoming and guide the first action
- schedules and runs empty states should explain what appears here and how to populate it
- dashboard and admin empty states should avoid unfinished-product vibes

### 9.4 Error states
Errors should be visible, local when possible, and tonally consistent.

Rules:
- field issues stay near the field or action cluster
- page-level failures use a shared error panel style
- chat errors should preserve surrounding context
- avoid inconsistent one-off alert patterns across pages

### 9.5 Success and transient feedback
Use toasts for short-lived operation feedback where appropriate, but avoid over-notifying.

## 10. Theme Strategy

### 10.1 Theme behavior
- default theme: light
- secondary theme: dark
- both themes share one semantic token model
- theme switching should be globally available from the shell

### 10.2 Theme quality bar
Dark mode must be intentionally designed, not passively inherited. Both themes should preserve hierarchy, readability, and calm visual rhythm.

## 11. Accessibility and Usability

The redesign should preserve or improve practical usability:
- visible focus states
- sufficient contrast in both themes
- clear disabled treatment
- stable reading widths and spacing
- no interaction that depends only on motion or color

## 12. Verification Plan

### Code verification
Run affected workspace checks appropriate to the final scope:
- `pnpm --filter @ai-chat/web lint`
- `pnpm --filter @ai-chat/web test`
- `pnpm --filter @ai-chat/web build`

### Browser verification
Use real browser validation for final acceptance.

Critical flows to verify:
- login
- protected route access
- chat send and streaming flow
- tool execution rendering
- schedules create/view interactions
- runs browsing
- theme toggle behavior
- dashboard/admin layout correctness

## 13. Deliverables

The redesign should produce:
1. a unified visual token layer for web UI
2. upgraded base components aligned with shadcn/ui conventions
3. a redesigned app shell
4. refreshed login, chat, schedules, runs, dashboard, and admin pages
5. consistent loading, empty, error, and success feedback patterns
6. light and dark themes with light as the default

## 14. Out-of-Scope Reminder

The implementation should not:
- modify API contracts
- rewrite backend logic
- significantly re-architect frontend state management
- expand product capabilities beyond the UI refresh
- introduce unnecessary framework-level complexity

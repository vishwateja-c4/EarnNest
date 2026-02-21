# EarnNest — Technical Documentation

## Overview
A Supabase-backed campus freelancing marketplace restricted to verified college emails. EarnNest lets students post tasks, apply, chat, track escrow-style balances, and build reliability scores. The app is implemented with React 19 + Vite, Tailwind v4, shadcn/ui, and React Router v7.

## Tech Stack
- Frontend: React 19, Vite, TypeScript
- Styling/UI: Tailwind CSS v4, shadcn/ui components, lucide-react icons
- Routing: React Router DOM v7
- Backend/BaaS: Supabase (PostgreSQL, Auth, RLS, Realtime)

## Data Model (Supabase)
Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor. Tables with RLS:
- `profiles`: Extends `auth.users`; stores name, college email, dept/year, skills[], bio, availability, reliability score, completed count.
- `wallets`: 1:1 with profiles; tracks `available_balance` and `locked_balance`.
- `tasks`: Marketplace tasks with client owner, budget, deadline, priority, status, required_skills[], assigned freelancer.
- `applications`: Freelancer applications with pitch + status per task.
- `messages`: Task-scoped chat with realtime publication enabled.

RPCs: run [supabase/update_score_rpc.sql](supabase/update_score_rpc.sql) to enable `update_freelancer_score` (used on task completion to update reliability and counts).

## Frontend Architecture
- Entry: [src/App.tsx](src/App.tsx) wires routes under a layout shell; [src/main.tsx](src/main.tsx) mounts.
- Theme: [src/components/theme-provider.tsx](src/components/theme-provider.tsx) + [src/components/mode-toggle.tsx](src/components/mode-toggle.tsx) for light/dark with localStorage key `vite-ui-theme`.
- Auth/Session: [src/context/AuthContext.tsx](src/context/AuthContext.tsx) tracks Supabase session, auto-ensures `profiles` and `wallets` rows exist, exposes `signOut`.
- Layout: [src/components/layout](src/components/layout) provides navbar/footer shell with auth-aware links.

## Core Screens & Flows
- Login: [src/pages/Login.tsx](src/pages/Login.tsx) enforces college email domain, supports sign-up/sign-in via Supabase email/password.
- Profile: [src/pages/Profile.tsx](src/pages/Profile.tsx) edit/view profile, skills tags, and Availability Status System (Free Now/1 Hour/Tonight/Weekends/Busy).
- Task Marketplace: [src/pages/TaskFeed.tsx](src/pages/TaskFeed.tsx) fetches open tasks, client-side filters (search, category, budget, priority). [src/pages/CreateTask.tsx](src/pages/CreateTask.tsx) posts new tasks for the logged-in client.
- Task Details: [src/pages/TaskDetails.tsx](src/pages/TaskDetails.tsx) shows task info, allows freelancers to apply with a pitch; clients view applicants and assign, changing status to ASSIGNED.
- Chat: [src/pages/Chat.tsx](src/pages/Chat.tsx) task-scoped messaging between client and assigned freelancer with realtime inserts.
- Dashboard: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) dual tabs for Freelancer and Client views: balances, active assignments, pending applications, completed gigs, client tasks needing action, review-and-complete flow calling `update_freelancer_score` RPC.
- Wallet: [src/pages/Wallet.tsx](src/pages/Wallet.tsx) reads Supabase wallet balances; transaction list currently mock data placeholder.
- Routing fallback: [src/pages/NotFound.tsx](src/pages/NotFound.tsx).

## Configuration
Create `.env.local` with:
- `VITE_SUPABASE_URL=https://<your-project>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<anon-key>`

Ensure Supabase Realtime is enabled for `messages` (publication already added in schema).

## Development
- Install deps: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`

## Current Gaps / Next Enhancements
- Replace mock wallet transactions with Supabase history.
- Add route guards/toasts for auth-only pages; replace `alert` with UI toasts.
- Add validation (zod/react-hook-form) and optimistic UI for chat and task actions.
- Add escrow lock/release flows (RPC or edge functions) and transaction audit.

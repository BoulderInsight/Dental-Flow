# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DentalFlow Pro is an interactive architecture visualization for a dental practice financial management system. It's currently a single-page React app that renders an SVG-based system architecture diagram with clickable components showing implementation details.

The visualization documents the planned full system: QBO integration, sync engine, PostgreSQL/Redis data layer, 3-tier categorization (rules → ML → user feedback), transaction review UI, and cash flow forecasting. Only the architecture visualization component exists as code today — the backend services it describes are not yet implemented.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally
- `npm run lint` — Run ESLint

## Tech Stack

- React 19 with JSX (no TypeScript)
- Vite 7 with `@vitejs/plugin-react`
- ESLint 9 flat config with react-hooks and react-refresh plugins

## Architecture

The app is minimal — a single component renders everything:

- `src/main.jsx` — React root, renders `<App />`
- `src/App.jsx` — Wrapper that renders `<DentalFlowArch />`
- `src/DentalFlow_Architecture.jsx` — All architecture diagram logic: layer data, connection data, phase timeline, SVG rendering, and detail panel. Uses inline styles throughout (no CSS framework).

## ESLint

The `no-unused-vars` rule is configured to ignore variables starting with uppercase letters or underscores (`varsIgnorePattern: '^[A-Z_]'`).

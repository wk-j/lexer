---
name: cr-first-design
description: "When implementing new features in Lexer, always design as a Change Request (CR) document in docs/cr/ first before writing any code. Use this skill when asked to add a feature, implement functionality, create a new capability, or build something new."
metadata:
  audience: developers
  workflow: design-first
---

## What I do

Enforce a CR-first workflow: every new feature must be designed as a Change Request document in `docs/cr/` before any code is written. The CR is reviewed and approved by the user, then implementation follows the approved design.

## When to use me

Use this skill whenever you are asked to:
- Add a new feature or capability
- Implement new user-facing behavior
- Add new keyboard shortcuts, commands, or configuration options
- Add new CSS custom properties or theme fields
- Add new Tauri commands or IPC endpoints
- Introduce new dependencies or architectural changes
- Change window chrome or layout system behavior

Do NOT use this skill for:
- Bug fixes to existing behavior (unless the fix changes behavior)
- Refactoring with no user-visible change
- Dependency version updates
- Documentation-only changes
- Code formatting

## Workflow

```
User requests a new feature
        |
        v
  Is it a bug fix or trivial change?
  (< 2 files, no new behavior)
        |
    YES |          NO
        v           v
  Fix directly   Write CR document in docs/cr/
                    |
                    v
              Present CR to user for review
                    |
                    v
              User approves?
                    |
                YES |          NO
                    v           v
              Implement      Revise CR based
              the feature    on feedback
                    |           |
                    v       <---+
              Update CR status
              to "Implemented"
                    |
                    v
              Update relevant
              spec docs in docs/
```

## CR Document Format

### Filename

```
docs/cr/{NNN}-{kebab-case-slug}.md
```

- `NNN` = zero-padded 3-digit number, sequential after the highest existing CR
- `slug` = short kebab-case summary

Find the next number by listing existing CRs:

```bash
ls docs/cr/
```

### Template

```markdown
# CR-{NNN}: {Descriptive Title}

**Date:** {YYYY-MM-DD}
**Status:** Draft
**Scope:** {Comma-separated areas: UI, Theme Engine, Keyboard, Config, etc.}

---

## Summary

{1-3 sentences describing the feature and its purpose.}

---

## Motivation

{Why this feature is needed. What user problem does it solve?}

---

## Design

### {Subsection per component/concern}

{Detailed design with tables, code snippets, diagrams as needed.}

**Files:** `path/to/file1`, `path/to/file2`

---

## Files to Modify

| File | Change |
|---|---|
| `path/to/file` | Brief description of change |

## Files to Update (Docs)

| File | Change |
|---|---|
| `docs/NN-slug.md` | What to update in the spec |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| {edge case} | {expected behavior} |

---

## Future Enhancements

- {Bullet list of out-of-scope follow-ups}

---

## Spec References

- `docs/NN-slug.md` -- {relevance}
```

### Status Values

| Status | Meaning |
|---|---|
| `Draft` | Initial design, not yet approved |
| `Approved` | User approved, ready for implementation |
| `Implemented` | Code is written and working |
| `Superseded` | Replaced by a later CR |

### Optional Metadata Fields

Add to the CR header when relevant:
- **Platform:** `macOS first` / `cross-platform`
- **Depends on:** `CR-NNN`

## Writing Guidelines

### Be specific about files

Every design subsection MUST list affected files with a `**Files:**` line. The `Files to Modify` table summarizes all of them.

### Include code snippets

Show key structs, function signatures, config formats, CSS properties, and HTML structure. The CR should be detailed enough that implementation is mostly mechanical.

### Show new config/theme fields

If adding configuration, show exact TOML format:

```toml
[section]
field_name = "value"
```

### Show new CSS custom properties

List them in a table:

| Property | Default | Description |
|---|---|---|
| `--prop-name` | `value` | What it controls |

### Reference existing specs

Always include `## Spec References` linking to relevant numbered docs in `docs/`.

### Edge cases are required

The `## Edge Cases` table forces thinking about failure modes, platform differences, and feature interactions. Never skip it.

## After Implementation

1. Update the CR status from `Draft` to `Implemented`
2. Reconcile any deviations between CR and actual implementation
3. Update numbered spec docs listed in `## Spec References` and `## Files to Update (Docs)`
4. Update `docs/PROGRESS.md` if relevant items exist

## Existing CR Examples

Reference these for style and depth:
- `docs/cr/001-gx-border-and-traffic-lights.md` — UI + theme + window chrome
- `docs/cr/002-global-toggle-shortcut.md` — Config + Rust + platform-specific

## Project Context

| Area | Key Files |
|---|---|
| Rust entry & setup | `src-tauri/src/main.rs` |
| Tauri commands | `src-tauri/src/commands.rs` |
| App state | `src-tauri/src/state.rs` |
| Config | `src-tauri/src/config.rs` |
| Theme engine | `src-tauri/src/theme/engine.rs` |
| Markdown parser | `src-tauri/src/markdown/parser.rs` |
| Tree-sitter | `src-tauri/src/highlight/` |
| File I/O | `src-tauri/src/fs/` |
| Theme TOML files | `src-tauri/themes/*.toml` |
| HTML shell | `src/index.html` |
| Core app JS | `src/app.js` |
| Keyboard engine | `src/keyboard.js` |
| Command palette | `src/palette.js` |
| ToC / layout | `src/layout.js` |
| Effects engine | `src/effects.js` |
| Base styles | `src/style.css` |
| Effect styles | `src/effects.css` |
| Layout modes | `src/layout.css` |
| Spec index | `docs/SPEC.md` |
| Progress tracker | `docs/PROGRESS.md` |

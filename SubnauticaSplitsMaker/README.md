# Subnautica Splits Maker

Subnautica Splits Maker is a browser-based split editor for **LiveSplit** runners.
It is built specifically for **Subnautica** categories and category extensions, with support for autosplit settings, nested conditions, import/export, and shareable runs.

This tool is made to be simple for runners to use, not just developers.

## What This Is For

- Creating new Subnautica split files quickly
- Editing existing `.lss` split files without manual XML editing
- Managing autosplitter settings and split order in one place
- Sharing full run setups with one URL

## Paired Tools

- LiveSplit (required to run splits):  
  https://livesplit.org/downloads/
- Subnautica Autosplitter reference/project context:  
  https://github.com/Sprinter31/Subnautica_Autosplitter

## Inspiration

- Hollow Knight Split Maker design/workflow inspiration:  
  https://hksplitmaker.com/?game=hollowknight

## Main Features

- Subnautica-themed UI focused on speedrun workflow
- Preset loading support
- Full split tree editor with drag/drop reordering
- Nested split conditions
- Manual split support (no autosplit trigger)
- Split icon upload and preview
- `.lss` import and export
- JSON backup import and export
- Share URL generation and loading
- Local autosave recovery

## How To Use (Runner Flow)

1. Open the app.
2. Pick a preset (or start blank).
3. Choose your category + variables in Run Setup.
4. Build or edit your split tree.
5. Tune autosplitter settings.
6. Download with **Download Splits**.
7. Load the file in LiveSplit.

## Import / Export

- **Import Splits**: loads a LiveSplit `.lss` file into the editor
- **Download Splits**: exports a LiveSplit-ready `.lss` file
- **Import JSON / Download JSON**: backup and restore full editor state

## Share URLs

- **Copy Share URL** creates a full link that includes your current setup.
- Opening that link restores the same run configuration.
- Share links are supported for GitHub Pages hosting.

## Presets

- You can choose from presets splits to load for many categories
- for now its just Any% Survival Glitched

## Notes

- This is a static web app: no account and no backend required.
- If you clear splits, preset selection is also cleared so your state stays consistent.

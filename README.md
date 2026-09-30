# Quick Tasks

Compact task manager for Windows. A dynamic-island style popup at the top of the screen plus a small taskbar widget.

- Open: tap **Ctrl+Alt**, press **Ctrl+Alt+T**, or click the taskbar widget
- Add tasks with inline codes: `#tag`, `!!!` priority, `@fri 5pm` deadline, `~30m` effort
- Keys: Down to select, Space cycles status, E edits, Del removes, Ctrl+Z undoes, 1/2/3 switch views, Esc closes

## Run

    npm install
    npx electron .

Tasks are stored locally in `data.json` (not committed).

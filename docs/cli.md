# Boronix CLI Reference

The Boronix command-line interface provides tools for development, building, and inspecting your fullstack applications.

## Usage

```bash
boronix <command> [options]
```

## Commands

### `dev`
Start the development server with live request activity logging, file watching, and automatic browser refresh.

```bash
boronix dev [options]
```

**Options:**
- `--root <dir>`: Project root directory (default: `.`)
- `--runtime <bun|node>`: Target server runtime (default: `bun`)
- `-p, --port <port>`: Port to listen on (default: `3000`)
- `-H, --host <host>`: Host to bind to (default: `0.0.0.0`)
- `-o, --open`: Open the browser automatically
- `--quiet`: Startup and errors output only
- `--verbose`: Detailed output with static asset requests
- `--no-reload`: Disable browser auto-refresh and file watcher
- `--debug-watch`: Print detailed file watch diagnostics
- `--plain`: Disable colors, unicode, and spinner
- `--no-color`: Disable terminal colors

### `build`
Compile your server-rendered app and generate a production manifest in `.boronix`, rendering a route build tree.

```bash
boronix build [options]
```

**Options:**
- `--root <dir>`: Project root directory
- `--runtime <bun|node>`: Production target runtime
- `--plain`: Disable styling
- `--no-color`: Disable colors

### `start`
Start the production server using the built manifest in `.boronix`.

```bash
boronix start [options]
```

**Options:**
- `--root <dir>`: Project root directory
- `--runtime <bun|node>`: Production server runtime override
- `-p, --port <port>`: Server port override
- `-H, --host <host>`: Server host override
- `--quiet`: Startup and errors output only
- `--verbose`: Detailed request logs
- `--plain`: Disable styling
- `--no-color`: Disable colors

### `routes`
List all project routes as a tree.

```bash
boronix routes [options]
```

**Options:**
- `--json`: Output routes summary in machine JSON format
- `--full`: Output full absolute paths of matched source modules
- `--flat`: Output a flat route list without tree structures
- `--plain`: Disable styling and colors
- `--no-color`: Disable colors

### `inspect`
Inspect matched files and parameters for a specific URL route.

```bash
boronix inspect <url> [options]
```

---

## Global Flags

- `-h, --help`: Show help message
- `-v, --version`: Show version number
- `--plain`: Force plain text output (removes color, unicode, spinner)
- `--no-color`: Turn off ANSI coloring

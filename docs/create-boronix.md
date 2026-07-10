# create-boronix

A command-line generator to bootstrap a new Boronix application in seconds.

## Usage

```bash
bunx create-boronix <project-name>
```

If you do not provide a project name, `create-boronix` runs interactively and prompts you for:
1. **Project name**: The folder name.
2. **Template**: Choose between `basic` (minimal start) and `homework` (dogfood reference).
3. **Runtime**: Choose target runtime (`bun` or `node`).
4. **Database**: Choose `none`, `sqlite`, or `postgres`.
5. **Install dependencies**: Installs packages automatically.
6. **Initialize git**: Configures a git repository inside the project.

## Non-Interactive Mode

When a project name argument is passed, it builds using defaults:
- **template**: basic
- **runtime**: bun
- **db**: none
- **install**: false
- **git**: false

Database runtime support:

```txt
--db sqlite   requires --runtime bun
--db postgres works with bun or node
--db none     works with bun or node
```

New projects use `app/routes/page.html` for `/`; no `app/routes/home` folder is generated.

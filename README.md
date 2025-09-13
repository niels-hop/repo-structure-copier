# Repository Structure Copier

This Visual Studio Code extension allows you to copy the structure of your repository to the clipboard, including file contents, while respecting ignore rules.

## Features

- Works across all folders in multi-root workspaces
- Lets you preview and select files before exporting
- Shows progress with the ability to cancel long operations
- Respects `.repoignore`, `.gitignore` and VS Code's `files.exclude`
- Copies to clipboard or saves the output to a file
- Provides a token count for the final selection

## Usage

1. Open a repository in VS Code
2. Use the keyboard shortcut:
   - Windows: `Ctrl+Alt+C`
   - macOS: `Cmd+Alt+C`
3. Alternatively, you can:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette
   - Type "Copy Repository Structure" and select the command
4. The repository structure will be copied to your clipboard, and you'll see a notification with the token count

## Ignoring files

Create a `.repoignore` file in the root of your repository to specify files and directories to exclude. The syntax is similar to `.gitignore`.

The extension also falls back to `.gitignore` and VS Code's `files.exclude` setting so common temporary or build artifacts are skipped automatically.

Example `.repoignore`:

```
node_modules
*.log
.vscode
```

## Token Count

The extension provides a token count for the copied structure, which can be useful for estimating usage with large language models. The count is displayed in the notification after copying.

## Requirements

- Visual Studio Code 1.60.0 or higher

## Extension Settings

This extension does not add any VS Code settings.

## Known Issues

- Large repositories may take some time to process
- Very large files might cause performance issues

**Enjoy!**
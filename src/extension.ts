import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import ignore from 'ignore';
import * as tiktoken from 'tiktoken';

/**
 * RepoStructureCopier collects file contents from all workspace folders and allows the
 * user to review and export the combined structure. It supports ignore rules from
 * `.repoignore`, `.gitignore` and VS Code's `files.exclude` setting.
 */
class RepoStructureCopier {
    private ig = ignore();

    async run() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        await this.loadIgnoreRules(folders);

        const tokenSource = new vscode.CancellationTokenSource();

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                cancellable: true,
                title: 'Collecting repository structure…'
            },
            async (progress, token) => {
                token.onCancellationRequested(() => tokenSource.cancel());
                const items = await this.collectFileItems(folders, tokenSource.token);
                if (tokenSource.token.isCancellationRequested) {
                    return;
                }

                const selection = await vscode.window.showQuickPick(items, {
                    canPickMany: true,
                    placeHolder: 'Select files to include'
                });
                if (!selection || selection.length === 0) {
                    return;
                }

                const structure = this.buildStructure(selection);
                const totalTokens = selection.reduce((sum, item) => sum + (item.tokenCount ?? 0), 0);
                const formattedTokenCount = this.formatTokenCount(totalTokens);

                const outputChoice = await vscode.window.showQuickPick(
                    ['Copy to clipboard', 'Save to file'],
                    { placeHolder: 'Select output option' }
                );
                if (!outputChoice) {
                    return;
                }

                if (outputChoice === 'Copy to clipboard') {
                    await vscode.env.clipboard.writeText(structure);
                } else {
                    const uri = await vscode.window.showSaveDialog({ filters: { 'Text Files': ['txt'] } });
                    if (uri) {
                        await fs.writeFile(uri.fsPath, structure, 'utf8');
                    } else {
                        return;
                    }
                }

                vscode.window.showInformationMessage(
                    `Repository structure processed. Token count: ${formattedTokenCount}`
                );
            }
        );
    }

    private async loadIgnoreRules(folders: readonly vscode.WorkspaceFolder[]) {
        for (const folder of folders) {
            const repoignore = path.join(folder.uri.fsPath, '.repoignore');
            const gitignore = path.join(folder.uri.fsPath, '.gitignore');
            for (const file of [repoignore, gitignore]) {
                try {
                    const content = await fs.readFile(file, 'utf8');
                    this.ig.add(content);
                } catch {
                    // ignore missing files
                }
            }
        }
        const filesExclude = vscode.workspace
            .getConfiguration('files')
            .get<Record<string, boolean>>('exclude', {});
        for (const [pattern, enabled] of Object.entries(filesExclude)) {
            if (enabled) {
                this.ig.add(pattern);
            }
        }
    }

    private async collectFileItems(
        folders: readonly vscode.WorkspaceFolder[],
        token: vscode.CancellationToken
    ) {
        const items: FileItem[] = [];
        for (const folder of folders) {
            const files = await this.walk(folder.uri.fsPath, folder.uri.fsPath, token);
            for (const file of files) {
                if (token.isCancellationRequested) {
                    break;
                }
                const content = await fs.readFile(file, 'utf8');
                const tokenCount = this.countTokens(content);
                items.push({
                    label: file,
                    description: `${tokenCount} tokens`,
                    tokenCount,
                    content
                });
            }
        }
        return items;
    }

    private async walk(
        dir: string,
        root: string,
        token: vscode.CancellationToken,
        collected: string[] = []
    ): Promise<string[]> {
        if (token.isCancellationRequested) {
            return collected;
        }

        const entries = await fs.readdir(dir);
        for (const entry of entries) {
            const full = path.join(dir, entry);
            const rel = path.relative(root, full);
            if (this.ig.ignores(rel)) {
                continue;
            }
            const stat = await fs.stat(full);
            if (stat.isDirectory()) {
                await this.walk(full, root, token, collected);
            } else {
                collected.push(full);
            }
            if (token.isCancellationRequested) {
                break;
            }
        }
        return collected;
    }

    private buildStructure(selected: FileItem[]): string {
        let result = '<codebase>';
        for (const item of selected) {
            result += `<file><path>${item.label}</path><content>${item.content}</content></file>`;
        }
        result += '</codebase>';
        return result;
    }

    private countTokens(text: string): number {
        const enc = tiktoken.encoding_for_model('gpt-4');
        const tokens = enc.encode(text);
        enc.free();
        return tokens.length;
    }

    private formatTokenCount(count: number): string {
        return count < 1000 ? count.toString() : `${(count / 1000).toFixed(1)}k`;
    }
}

interface FileItem extends vscode.QuickPickItem {
    content: string;
    tokenCount?: number;
}

export function activate(context: vscode.ExtensionContext) {
    const copier = new RepoStructureCopier();
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.copyRepoStructure', () => copier.run())
    );
}

export function deactivate() {}


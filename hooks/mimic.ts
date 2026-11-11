// What the pet acts out: Claude's tool calls and the person's slash commands.
const TOOL_STATE: Record<string, string> = {
  Read: 'read', Grep: 'read', Glob: 'read', NotebookRead: 'read',
  Edit: 'write', Write: 'write', MultiEdit: 'write', NotebookEdit: 'write',
  Bash: 'type', BashOutput: 'type',
  WebSearch: 'search', WebFetch: 'search',
  Agent: 'clone', Task: 'clone',
}
const COMMAND_STATE: Record<string, string> = { compact: 'squash', clear: 'wipe', model: 'hat' }

export const toolState = (tool: string) => TOOL_STATE[tool] ?? 'work'
export const commandState = (command: string) => COMMAND_STATE[command] ?? 'copy'

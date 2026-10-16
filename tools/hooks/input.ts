// What Claude Code sends a hook on stdin (https://code.claude.com/docs/en/hooks): the fields these hooks use.
export interface HookInput {
  session_id?: string;
  hook_event_name?: string;
  // PostToolUse on Edit and Write: the file's absolute path.
  tool_input?: { file_path?: string };
  // Stop: true when the agent is carrying on because a Stop hook blocked it.
  stop_hook_active?: boolean;
}

export async function readInput(): Promise<HookInput> {
  let text = '';
  for await (const chunk of process.stdin) text += String(chunk);
  return text.trim() ? (JSON.parse(text) as HookInput) : {};
}

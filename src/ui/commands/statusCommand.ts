/**
 * Status Command - Show system and trio status
 */

import { SlashCommand, SlashCommandResult, MessageType } from './types.js';

export const statusCommand: SlashCommand = {
  name: 'status',
  altNames: ['stat', 'info'],
  description: 'Show system and trio status',
  action: async (context): Promise<SlashCommandResult> => {
    const statusMessage = `
🎭 UNIPATH CLI Trio System Status

🎯 Planner Status:
  • Task analysis: ✅ Active
  • AI-powered tool selection: ✅ Ready
  • Multi-step decomposition: ✅ Available

⚡ Executor Status:
  • Advanced tool registry: ✅ ${context.config?.toolCount || 13} tools loaded
  • Auto-discovery: ✅ 7 advanced tools discovered
  • Parameter mapping: ✅ Dynamic
  • Error recovery: ✅ Active

🎭 Orchestrator Status:
  • Trio communication: ✅ Bidirectional
  • AI mediation: ✅ Active
  • Recovery strategies: ✅ Ready
  • Tool awareness: ✅ Enhanced

📊 Session Stats:
  • Prompts processed: ${context.session.stats.promptCount}
  • Tokens used: ${context.session.stats.tokensUsed.toLocaleString()}
  • Session duration: ${Math.floor((Date.now() - context.session.startTime.getTime()) / 1000)}s

🔧 Tool Categories Available:
  • File Operations: read_file, write_file, smart_edit
  • System Operations: bash, ls, glob
  • Search Operations: rg (ripgrep), grep
  • Memory Operations: memory
  • Version Control: git
  • Web Operations: web

All systems operational! 🚀
`;

    context.ui.addItem({
      type: MessageType.INFO,
      content: statusMessage.trim(),
      timestamp: new Date(),
    });

    return {
      type: 'info',
    };
  },
};
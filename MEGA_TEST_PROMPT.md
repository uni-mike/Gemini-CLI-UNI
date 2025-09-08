# UNIPATH CLI Mega Test Prompt
## Multi-Tool, Multi-Instance Test with Approvals

Copy and paste this entire prompt into UNIPATH CLI to test multiple tools, file operations, and approval flows:

---

Please complete the following comprehensive task that requires multiple tools and operations:

1. **Research Phase** (Web Search):
   - Search for "best practices for React hooks 2025"
   - Search for "TypeScript 5.0 new features"
   - Search for "Node.js performance optimization techniques"

2. **File Analysis Phase** (Read/Search):
   - Read the package.json file to understand project dependencies
   - Search for all TypeScript files containing "TODO" comments
   - Find all files that import React
   - Check if there are any files with "deprecated" in their content

3. **Documentation Creation** (Write/Create):
   - Create a new file called `TECH_RESEARCH_REPORT.md` with:
     - Summary of the React hooks best practices found
     - List of TypeScript 5.0 features
     - Node.js optimization tips
   - Create a `TODO_LIST.md` file listing all TODOs found in the codebase
   - Create a `DEPENDENCY_AUDIT.md` analyzing the current dependencies

4. **Code Modification** (Edit - triggers approvals):
   - Edit the main README.md to add a section "## Latest Updates" with today's date
   - Find and update any file containing "2024" to "2025" 
   - Add a comment "// Reviewed on [today's date]" to the top of deepSeekWithTools.ts

5. **Shell Operations** (Shell commands):
   - Run `ls -la packages/` to list all packages
   - Check Node version with `node --version`
   - Run `npm list --depth=0` to see direct dependencies
   - Create a backup directory with `mkdir -p backups/$(date +%Y%m%d)`

6. **Final Analysis**:
   - Search the web for "UNIPATH CLI alternatives comparison"
   - Create a final `ANALYSIS_COMPLETE.md` summarizing everything done

Please execute all these tasks, showing the approval prompts for edits, and handle multiple parallel tool executions where possible. Make sure to use the web_search tool multiple times and trigger the approval flow for file modifications.

---

## Expected Behavior:

1. **Multiple web searches** should execute (tests web_search tool)
2. **File reads and searches** should run in parallel where possible
3. **New files** should be created without approval
4. **File edits** should trigger approval UI (unless in auto-approve mode)
5. **Shell commands** should execute with appropriate permissions
6. **Multiple tools** should be called in succession and parallel

## To Test Different Modes:

### For Auto-Approve Mode:
```bash
./start-deepseek.sh --approval-mode auto
```

### For Manual Approval Mode:
```bash
./start-deepseek.sh --approval-mode manual
```

### For Trusted Folder Mode:
```bash
./start-deepseek.sh --trusted-folder
```

## Sample Test Command:

```bash
# Save the prompt to a file
cat > mega-test-input.txt << 'EOF'
[Paste the entire prompt from section above]
EOF

# Run with DeepSeek
./start-deepseek.sh < mega-test-input.txt

# Or run with timeout monitoring
timeout 120 ./start-deepseek.sh < mega-test-input.txt 2>&1 | tee mega-test-output.log
```

## What to Look For:

1. ✅ Multiple "🔍 Searching web for:" messages
2. ✅ "📋 Change Preview:" for file edits
3. ✅ "Do you want to:" approval prompts
4. ✅ Multiple "🔧 Executing function:" messages
5. ✅ Files being created in the directory
6. ✅ Shell command outputs
7. ✅ No hanging or freezing
8. ✅ Proper error handling for any failed operations

## Troubleshooting:

If the CLI hangs:
- Check if it's waiting for approval input
- Look for "Tool execution results:" in output
- Monitor with `ps aux | grep node` for stuck processes
- Check the last lines of output for clues

If approvals aren't showing:
- Verify approval mode with `--approval-mode manual`
- Check if folder is trusted with `--trusted-folder` flag
- Look for "AUTO_EDIT mode" messages in output
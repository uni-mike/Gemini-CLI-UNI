# UNIPATH CLI Companion Installation for PyCharm

## Automatic Installation (Coming Soon)
The automatic installer for PyCharm is under development.

## Manual Installation

### Option 1: Install from Plugin Marketplace (Recommended)
1. Open PyCharm
2. Go to File → Settings → Plugins (or PyCharm → Preferences → Plugins on macOS)
3. Search for "UNIPATH CLI Companion" 
4. Click Install

### Option 2: Install from Local Build
1. Navigate to: /Users/mike.admon/UNIPATH_PROJECT/gemini-cli/extensions/unipath-jetbrains-companion/
2. Build the plugin: ./gradlew buildPlugin
3. In PyCharm: File → Settings → Plugins → Gear Icon → Install Plugin from Disk
4. Select the built .jar file from build/distributions/

### Configuration
After installation:
1. Restart PyCharm
2. Open your project in PyCharm
3. Run UNIPATH CLI in the integrated terminal
4. Use /ide enable to connect

For more information, visit: https://github.com/unipath-ai/unipath-cli

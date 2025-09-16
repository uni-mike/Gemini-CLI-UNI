# UNIPATH CLI Companion Extensions

Local installer for UNIPATH CLI Companion extensions supporting VS Code, PyCharm, WebStorm, and IntelliJ IDEA.

## 🚀 Quick Start

```bash
# Install for all detected IDEs
./install-unipath-extensions.sh

# Install for specific IDE
./install-unipath-extensions.sh --ide=pycharm
./install-unipath-extensions.sh --ide=webstorm
./install-unipath-extensions.sh --ide=vscode
./install-unipath-extensions.sh --ide=intellij
```

## 📦 What's Included

### ✅ VS Code Extension
- **Name**: UNIPATH CLI Companion
- **Features**: Native diff viewing, file context, selection tracking
- **Installation**: Automatically builds and installs `.vsix` package
- **Requirements**: VS Code with `code` CLI command available

### ✅ JetBrains IDEs (PyCharm, WebStorm, IntelliJ IDEA)
- **Name**: UNIPATH CLI Companion
- **Features**: Native diff viewing, IDE integration, terminal awareness
- **Installation**: Creates plugin template and installation guides
- **Requirements**: Target IDE installed

## 🛠️ Installation Methods

### Option 1: Automatic Installation (Recommended)
```bash
# Make installer executable
chmod +x install-unipath-extensions.sh

# Run installer
./install-unipath-extensions.sh
```

### Option 2: Manual Installation

#### VS Code
```bash
cd extensions/unipath-vscode-companion
npm install
npm run package
code --install-extension *.vsix
```

#### JetBrains IDEs
1. See generated installation guides:
   - `extensions/install-PyCharm-plugin.md`
   - `extensions/install-WebStorm-plugin.md`
   - `extensions/install-IntelliJ-IDEA-plugin.md`

## 🎯 Usage After Installation

1. **Restart your IDE**
2. **Open your project**
3. **Run UNIPATH CLI in terminal**:
   ```bash
   ./start-deepseek.sh  # or your preferred startup script
   ```
4. **Enable IDE integration**:
   ```bash
   /ide enable
   ```
5. **Verify connection**:
   ```bash
   /ide status
   ```

## 🔧 Features

### VS Code Integration
- ✅ **Native Diffs**: View and accept code changes directly in VS Code
- ✅ **File Context**: UNIPATH CLI sees your open files
- ✅ **Selection Tracking**: Access cursor position and selected text
- ✅ **Quick Launch**: Run UNIPATH CLI from Command Palette

### JetBrains Integration
- ✅ **Terminal Awareness**: Auto-detects PyCharm, WebStorm, IntelliJ
- ✅ **Project Context**: Access to workspace and open files
- ✅ **Native Diff Views**: Integrated diff approval workflow
- ✅ **Session Management**: AUTO_EDIT, YOLO approval modes

## 🚨 Troubleshooting

### VS Code Issues
```bash
# Check if code CLI is available
code --version

# Manually install extension
code --install-extension extensions/unipath-vscode-companion/*.vsix
```

### JetBrains Issues
```bash
# Check IDE detection
echo $TERMINAL_EMULATOR
echo $PYCHARM_HOSTED
echo $WEBSTORM_HOSTED

# Verify environment
./start-deepseek.sh --prompt "/ide status"
```

### Connection Issues
1. **Restart IDE** after extension installation
2. **Check terminal environment**:
   ```bash
   env | grep -E "(TERMINAL_EMULATOR|PYCHARM|WEBSTORM|JETBRAINS)"
   ```
3. **Try manual connection**:
   ```bash
   /ide enable
   ```

## 📋 System Requirements

- **Node.js** 20+ (for VS Code extension building)
- **npm** (for package management)
- **VS Code** 1.99.0+ (for VS Code extension)
- **PyCharm/WebStorm/IntelliJ** 2023.2+ (for JetBrains extensions)

## 🔐 Distribution

This package contains:
- ✅ **Rebranded Extensions**: Full UNIPATH CLI branding
- ✅ **Local Installation**: No marketplace dependencies
- ✅ **Multi-IDE Support**: VS Code + JetBrains ecosystem
- ✅ **Easy Sharing**: Single script installer

## 📞 Support

For issues with:
- **Extension Installation**: Check the generated installation guides
- **IDE Detection**: Ensure IDE is properly installed and in PATH
- **Connection Problems**: Verify UNIPATH CLI is running and `/ide enable` works

---

**🎉 Ready to enhance your UNIPATH CLI experience with native IDE integration!**
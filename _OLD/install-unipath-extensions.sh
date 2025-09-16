#!/bin/bash

# UNIPATH CLI Companion Extensions Installer
# Supports VS Code, PyCharm, WebStorm, and IntelliJ IDEA
# 
# Usage: ./install-unipath-extensions.sh [--ide=all|vscode|pycharm|webstorm|intellij]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSIONS_DIR="$SCRIPT_DIR/extensions"
VERSION="1.0.0"

# Parse command line arguments
IDE_TARGET="all"
for arg in "$@"; do
    case $arg in
        --ide=*)
            IDE_TARGET="${arg#*=}"
            shift
            ;;
        --help|-h)
            echo "UNIPATH CLI Companion Extensions Installer"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --ide=all|vscode|pycharm|webstorm|intellij  Install for specific IDE(s) (default: all)"
            echo "  --help, -h                                   Show this help message"
            echo ""
            echo "Supported IDEs:"
            echo "  - VS Code (vscode)"
            echo "  - PyCharm (pycharm)"
            echo "  - WebStorm (webstorm)"
            echo "  - IntelliJ IDEA (intellij)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 UNIPATH CLI Companion Extensions Installer v$VERSION${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Function to print status messages
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect installed IDEs
detect_ides() {
    local detected=()
    
    # Check VS Code
    if command_exists code; then
        detected+=("vscode")
    fi
    
    # Check PyCharm (various installation methods)
    if command_exists pycharm || command_exists charm || [ -d "/Applications/PyCharm.app" ] || [ -d "$HOME/Applications/PyCharm.app" ]; then
        detected+=("pycharm")
    fi
    
    # Check WebStorm
    if command_exists webstorm || [ -d "/Applications/WebStorm.app" ] || [ -d "$HOME/Applications/WebStorm.app" ]; then
        detected+=("webstorm")
    fi
    
    # Check IntelliJ IDEA
    if command_exists idea || [ -d "/Applications/IntelliJ IDEA.app" ] || [ -d "$HOME/Applications/IntelliJ IDEA.app" ]; then
        detected+=("intellij")
    fi
    
    echo "${detected[@]}"
}

# Function to install VS Code extension
install_vscode_extension() {
    log_info "Installing UNIPATH CLI Companion for VS Code..."
    
    if ! command_exists code; then
        log_error "VS Code CLI not found. Please install VS Code and ensure 'code' command is available in PATH"
        return 1
    fi
    
    # Build the extension
    cd "$EXTENSIONS_DIR/unipath-vscode-companion"
    
    if [ ! -f "package.json" ]; then
        log_error "VS Code extension package.json not found"
        return 1
    fi
    
    log_info "Building VS Code extension..."
    npm install
    npm run package
    
    # Install the extension
    local vsix_file=$(find . -name "*.vsix" -type f | head -n1)
    if [ -n "$vsix_file" ]; then
        code --install-extension "$vsix_file"
        log_success "VS Code extension installed successfully"
    else
        log_error "Failed to build VS Code extension"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Function to install JetBrains plugin (PyCharm, WebStorm, IntelliJ)
install_jetbrains_plugin() {
    local ide_name="$1"
    local ide_dir="$2"
    
    log_info "Installing UNIPATH CLI Companion for $ide_name..."
    
    # For now, create a simple installation guide since JetBrains plugins need to be built differently
    cat > "$EXTENSIONS_DIR/install-$ide_name-plugin.md" << EOF
# UNIPATH CLI Companion Installation for $ide_name

## Automatic Installation (Coming Soon)
The automatic installer for $ide_name is under development.

## Manual Installation

### Option 1: Install from Plugin Marketplace (Recommended)
1. Open $ide_name
2. Go to File → Settings → Plugins (or $ide_name → Preferences → Plugins on macOS)
3. Search for "UNIPATH CLI Companion" 
4. Click Install

### Option 2: Install from Local Build
1. Navigate to: $EXTENSIONS_DIR/unipath-jetbrains-companion/
2. Build the plugin: ./gradlew buildPlugin
3. In $ide_name: File → Settings → Plugins → Gear Icon → Install Plugin from Disk
4. Select the built .jar file from build/distributions/

### Configuration
After installation:
1. Restart $ide_name
2. Open your project in $ide_name
3. Run UNIPATH CLI in the integrated terminal
4. Use /ide enable to connect

For more information, visit: https://github.com/unipath-ai/unipath-cli
EOF
    
    log_success "Installation guide created: $EXTENSIONS_DIR/install-$ide_name-plugin.md"
}

# Function to create JetBrains plugin template
create_jetbrains_plugin() {
    local plugin_dir="$EXTENSIONS_DIR/unipath-jetbrains-companion"
    
    if [ -d "$plugin_dir" ]; then
        log_info "JetBrains plugin directory already exists"
        return 0
    fi
    
    log_info "Creating JetBrains plugin template..."
    mkdir -p "$plugin_dir/src/main/java/com/unipath/cli"
    mkdir -p "$plugin_dir/src/main/resources/META-INF"
    
    # Create plugin.xml
    cat > "$plugin_dir/src/main/resources/META-INF/plugin.xml" << 'EOF'
<idea-plugin>
    <id>com.unipath.cli-companion</id>
    <name>UNIPATH CLI Companion</name>
    <vendor>UNIPATH AI</vendor>
    <description><![CDATA[
        Enable UNIPATH CLI with direct access to your IDE workspace.
        
        Features:
        - Native diff viewing and editing
        - File context awareness
        - Selection and cursor position tracking
        - Seamless CLI integration
    ]]></description>
    
    <depends>com.intellij.modules.platform</depends>
    
    <extensions defaultExtensionNs="com.intellij">
        <!-- Extension points will be added here -->
    </extensions>
    
    <actions>
        <action id="unipath.runCLI" class="com.unipath.cli.actions.RunUnipathAction" text="Run UNIPATH CLI">
            <add-to-group group-id="ToolsMenu" anchor="last"/>
        </action>
    </actions>
</idea-plugin>
EOF
    
    # Create build.gradle
    cat > "$plugin_dir/build.gradle" << 'EOF'
plugins {
    id 'java'
    id 'org.jetbrains.intellij' version '1.16.1'
}

group 'com.unipath'
version '1.0.0'

repositories {
    mavenCentral()
}

intellij {
    version '2023.2'
    type 'IC' // IntelliJ IDEA Community Edition
    plugins = []
}

patchPluginXml {
    sinceBuild '232'
    untilBuild '242.*'
}

signPlugin {
    certificateChain = System.getenv("CERTIFICATE_CHAIN")
    privateKey = System.getenv("PRIVATE_KEY")
    password = System.getenv("PRIVATE_KEY_PASSWORD")
}

publishPlugin {
    token = System.getenv("PUBLISH_TOKEN")
}
EOF
    
    # Create main action class
    mkdir -p "$plugin_dir/src/main/java/com/unipath/cli/actions"
    cat > "$plugin_dir/src/main/java/com/unipath/cli/actions/RunUnipathAction.java" << 'EOF'
package com.unipath.cli.actions;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowManager;
import org.jetbrains.annotations.NotNull;

public class RunUnipathAction extends AnAction {
    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        if (project != null) {
            ToolWindow terminalWindow = ToolWindowManager.getInstance(project).getToolWindow("Terminal");
            if (terminalWindow != null) {
                terminalWindow.activate(() -> {
                    // Open terminal and run UNIPATH CLI
                });
            }
        }
    }
}
EOF
    
    log_success "JetBrains plugin template created at: $plugin_dir"
}

# Main installation logic
main() {
    log_info "Target IDE(s): $IDE_TARGET"
    
    # Detect available IDEs
    local detected_ides=($(detect_ides))
    log_info "Detected IDEs: ${detected_ides[*]:-none}"
    
    # Create JetBrains plugin template if needed
    if [[ "$IDE_TARGET" == "all" ]] || [[ "$IDE_TARGET" == "pycharm" ]] || [[ "$IDE_TARGET" == "webstorm" ]] || [[ "$IDE_TARGET" == "intellij" ]]; then
        create_jetbrains_plugin
    fi
    
    # Install extensions based on target
    local success_count=0
    local total_count=0
    
    if [[ "$IDE_TARGET" == "all" ]] || [[ "$IDE_TARGET" == "vscode" ]]; then
        ((total_count++))
        if [[ " ${detected_ides[@]} " =~ " vscode " ]] || [[ "$IDE_TARGET" == "vscode" ]]; then
            if install_vscode_extension; then
                ((success_count++))
            fi
        else
            log_warning "VS Code not detected, skipping installation"
        fi
    fi
    
    if [[ "$IDE_TARGET" == "all" ]] || [[ "$IDE_TARGET" == "pycharm" ]]; then
        ((total_count++))
        install_jetbrains_plugin "PyCharm" "pycharm"
        ((success_count++))
    fi
    
    if [[ "$IDE_TARGET" == "all" ]] || [[ "$IDE_TARGET" == "webstorm" ]]; then
        ((total_count++))
        install_jetbrains_plugin "WebStorm" "webstorm"
        ((success_count++))
    fi
    
    if [[ "$IDE_TARGET" == "all" ]] || [[ "$IDE_TARGET" == "intellij" ]]; then
        ((total_count++))
        install_jetbrains_plugin "IntelliJ IDEA" "intellij"
        ((success_count++))
    fi
    
    # Summary
    echo ""
    echo -e "${BLUE}=================================================${NC}"
    log_success "Installation completed: $success_count/$total_count extensions processed"
    
    if [ $success_count -gt 0 ]; then
        echo ""
        log_info "Next steps:"
        echo "1. Restart your IDE(s)"
        echo "2. Open your project"
        echo "3. Run UNIPATH CLI in the terminal"
        echo "4. Use '/ide enable' to connect"
        echo ""
        log_info "For JetBrains IDEs, see the installation guides in:"
        echo "  - $EXTENSIONS_DIR/install-*-plugin.md"
    fi
    
    if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"
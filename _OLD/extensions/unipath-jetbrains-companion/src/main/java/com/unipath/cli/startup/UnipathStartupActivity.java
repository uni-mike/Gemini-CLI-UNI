package com.unipath.cli.startup;

import com.intellij.openapi.project.Project;
import com.intellij.openapi.startup.StartupActivity;
import com.unipath.cli.server.MCPServer;
import org.jetbrains.annotations.NotNull;

public class UnipathStartupActivity implements StartupActivity {
    @Override
    public void runActivity(@NotNull Project project) {
        // Ensure MCP server is started when IDE opens
        MCPServer.getInstance();
    }
}
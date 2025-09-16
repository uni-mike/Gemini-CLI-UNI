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

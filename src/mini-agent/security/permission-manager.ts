/**
 * PermissionManager - Security-based access control for mini-agents
 * Manages tool permissions, validates access, and enforces security policies
 */

import { EventEmitter } from 'events';
import { ToolPermissions, SecurityPolicy, MiniAgentTask } from '../core/types.js';
import { Tool } from '../../tools/base.js';
import { Config } from '../../config/Config.js';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  alternatives?: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityViolation {
  agentId: string;
  toolName: string;
  violationType: 'unauthorized_tool' | 'resource_limit' | 'dangerous_operation' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  timestamp: number;
  blocked: boolean;
}

export class PermissionManager extends EventEmitter {
  private config: Config;
  private securityPolicy: SecurityPolicy;
  private violations: SecurityViolation[] = [];
  private agentPermissions: Map<string, ToolPermissions> = new Map();

  constructor(config: Config, securityPolicy: SecurityPolicy) {
    super();
    this.config = config;
    this.securityPolicy = securityPolicy;
  }

  /**
   * Register permissions for a mini-agent
   */
  public registerAgent(agentId: string, permissions: ToolPermissions): void {
    // Validate permissions against security policy
    const validatedPermissions = this.validateAndSanitizePermissions(permissions);

    this.agentPermissions.set(agentId, validatedPermissions);

    this.emit('agent-registered', {
      agentId,
      permissions: validatedPermissions,
      timestamp: Date.now()
    });
  }

  /**
   * Check if an agent can use a specific tool
   */
  public checkToolPermission(
    agentId: string,
    toolName: string,
    parameters?: any
  ): PermissionCheck {
    const permissions = this.agentPermissions.get(agentId);

    if (!permissions) {
      return {
        allowed: false,
        reason: 'Agent not registered with permission system',
        riskLevel: 'high'
      };
    }

    // Check if tool is explicitly allowed
    if (!permissions.allowed.includes(toolName)) {
      return this.handleUnauthorizedTool(agentId, toolName, permissions);
    }

    // Check if tool is explicitly restricted
    if (permissions.restricted.includes(toolName)) {
      return this.handleRestrictedTool(agentId, toolName);
    }

    // Check dangerous operations
    if (this.isDangerousTool(toolName) && !permissions.dangerousOperations) {
      return this.handleDangerousTool(agentId, toolName);
    }

    // Check git operations
    if (this.isGitTool(toolName) && !permissions.gitOperations) {
      return this.handleGitTool(agentId, toolName);
    }

    // Check network access
    if (this.requiresNetworkAccess(toolName) && !permissions.networkAccess) {
      return this.handleNetworkTool(agentId, toolName);
    }

    // Check file system access
    const fsCheck = this.checkFileSystemAccess(toolName, parameters, permissions);
    if (!fsCheck.allowed) {
      return fsCheck;
    }

    // Check resource limits
    const resourceCheck = this.checkResourceLimits(agentId, toolName, permissions);
    if (!resourceCheck.allowed) {
      return resourceCheck;
    }

    // Check read-only mode
    if (permissions.readOnly && this.isWriteTool(toolName)) {
      return this.handleReadOnlyViolation(agentId, toolName);
    }

    // All checks passed
    return {
      allowed: true,
      riskLevel: this.calculateToolRiskLevel(toolName)
    };
  }

  /**
   * Validate permissions against security policy
   */
  private validateAndSanitizePermissions(permissions: ToolPermissions): ToolPermissions {
    const policy = this.securityPolicy;

    // Remove dangerous tools if not allowed by policy
    const safeDangerous = permissions.allowed.filter(tool => {
      if (policy.toolRestrictions.dangerous.includes(tool)) {
        return permissions.dangerousOperations;
      }
      return true;
    });

    // Add policy restrictions
    const allRestricted = [
      ...new Set([
        ...permissions.restricted,
        ...policy.toolRestrictions.dangerous.filter(tool => !permissions.dangerousOperations)
      ])
    ];

    // Apply resource limits
    const maxToolCalls = Math.min(
      permissions.maxToolCalls,
      policy.resourceLimits.maxToolCalls
    );

    return {
      ...permissions,
      allowed: safeDangerous,
      restricted: allRestricted,
      networkAccess: permissions.networkAccess && policy.resourceLimits.networkCallsAllowed,
      maxToolCalls
    };
  }

  private handleUnauthorizedTool(
    agentId: string,
    toolName: string,
    permissions: ToolPermissions
  ): PermissionCheck {
    this.recordViolation({
      agentId,
      toolName,
      violationType: 'unauthorized_tool',
      severity: 'medium',
      details: `Tool '${toolName}' not in allowed list`,
      timestamp: Date.now(),
      blocked: true
    });

    const alternatives = this.suggestAlternativeTools(toolName, permissions);

    return {
      allowed: false,
      reason: `Tool '${toolName}' is not authorized for this agent`,
      alternatives,
      riskLevel: 'medium'
    };
  }

  private handleRestrictedTool(agentId: string, toolName: string): PermissionCheck {
    this.recordViolation({
      agentId,
      toolName,
      violationType: 'unauthorized_tool',
      severity: 'high',
      details: `Tool '${toolName}' is explicitly restricted`,
      timestamp: Date.now(),
      blocked: true
    });

    return {
      allowed: false,
      reason: `Tool '${toolName}' is explicitly restricted for this agent`,
      riskLevel: 'high'
    };
  }

  private handleDangerousTool(agentId: string, toolName: string): PermissionCheck {
    this.recordViolation({
      agentId,
      toolName,
      violationType: 'dangerous_operation',
      severity: 'critical',
      details: `Attempted to use dangerous tool '${toolName}' without permission`,
      timestamp: Date.now(),
      blocked: true
    });

    return {
      allowed: false,
      reason: `Tool '${toolName}' is classified as dangerous and requires explicit permission`,
      riskLevel: 'critical'
    };
  }

  private handleGitTool(agentId: string, toolName: string): PermissionCheck {
    this.recordViolation({
      agentId,
      toolName,
      violationType: 'policy_violation',
      severity: 'high',
      details: `Git operation '${toolName}' attempted without git permissions`,
      timestamp: Date.now(),
      blocked: true
    });

    return {
      allowed: false,
      reason: `Git operations are not permitted for this agent`,
      riskLevel: 'high'
    };
  }

  private handleNetworkTool(agentId: string, toolName: string): PermissionCheck {
    this.recordViolation({
      agentId,
      toolName,
      violationType: 'policy_violation',
      severity: 'medium',
      details: `Network access attempted via '${toolName}' without network permissions`,
      timestamp: Date.now(),
      blocked: true
    });

    return {
      allowed: false,
      reason: `Network access is not permitted for this agent`,
      riskLevel: 'medium'
    };
  }

  private handleReadOnlyViolation(agentId: string, toolName: string): PermissionCheck {
    this.recordViolation({
      agentId,
      toolName,
      violationType: 'policy_violation',
      severity: 'medium',
      details: `Write operation '${toolName}' attempted in read-only mode`,
      timestamp: Date.now(),
      blocked: true
    });

    return {
      allowed: false,
      reason: `Agent is in read-only mode, write operations not permitted`,
      alternatives: this.getReadOnlyAlternatives(toolName),
      riskLevel: 'medium'
    };
  }

  private checkFileSystemAccess(
    toolName: string,
    parameters: any,
    permissions: ToolPermissions
  ): PermissionCheck {
    const fsAccess = permissions.fileSystemAccess;

    // Check if tool requires file system access
    if (this.requiresFileSystemAccess(toolName)) {
      if (fsAccess === 'none') {
        return {
          allowed: false,
          reason: 'File system access not permitted',
          riskLevel: 'high'
        };
      }

      if (fsAccess === 'read' && this.isWriteTool(toolName)) {
        return {
          allowed: false,
          reason: 'Write access not permitted (read-only file system access)',
          alternatives: ['read', 'grep', 'search'],
          riskLevel: 'medium'
        };
      }
    }

    // Check file path restrictions
    if (parameters && this.hasFilePathParameter(toolName, parameters)) {
      const pathCheck = this.checkFilePathSecurity(parameters);
      if (!pathCheck.allowed) {
        return pathCheck;
      }
    }

    return { allowed: true, riskLevel: 'low' };
  }

  private checkResourceLimits(
    agentId: string,
    toolName: string,
    permissions: ToolPermissions
  ): PermissionCheck {
    // Check tool call limits (this would need to be tracked)
    // For now, just validate the permission exists
    if (permissions.maxToolCalls <= 0) {
      return {
        allowed: false,
        reason: 'Tool call limit exceeded',
        riskLevel: 'medium'
      };
    }

    return { allowed: true, riskLevel: 'low' };
  }

  private checkFilePathSecurity(parameters: any): PermissionCheck {
    const filePath = this.extractFilePath(parameters);

    if (!filePath) {
      return { allowed: true, riskLevel: 'low' };
    }

    // Check for path traversal attacks
    if (filePath.includes('..') || filePath.includes('~')) {
      return {
        allowed: false,
        reason: 'Path traversal detected in file path',
        riskLevel: 'critical'
      };
    }

    // Check for system file access
    const systemPaths = ['/etc/', '/usr/', '/bin/', '/sbin/', '/var/log/'];
    if (systemPaths.some(path => filePath.startsWith(path))) {
      return {
        allowed: false,
        reason: 'Access to system directories not permitted',
        riskLevel: 'high'
      };
    }

    // Check for sensitive files
    const sensitiveFiles = ['.env', '.secret', 'password', 'key', 'token'];
    if (sensitiveFiles.some(pattern => filePath.toLowerCase().includes(pattern))) {
      return {
        allowed: false,
        reason: 'Access to sensitive files detected',
        riskLevel: 'critical'
      };
    }

    return { allowed: true, riskLevel: 'low' };
  }

  // Tool classification methods
  private isDangerousTool(toolName: string): boolean {
    return this.securityPolicy.toolRestrictions.dangerous.includes(toolName);
  }

  private isGitTool(toolName: string): boolean {
    const gitTools = ['git', 'git-push', 'git-pull', 'git-commit', 'git-reset'];
    return gitTools.some(git => toolName.toLowerCase().includes(git.toLowerCase()));
  }

  private isWriteTool(toolName: string): boolean {
    const writeTools = ['write', 'edit', 'create', 'delete', 'rm', 'mkdir'];
    return writeTools.some(write => toolName.toLowerCase().includes(write.toLowerCase()));
  }

  private requiresNetworkAccess(toolName: string): boolean {
    const networkTools = ['fetch', 'curl', 'wget', 'http', 'api', 'download'];
    return networkTools.some(net => toolName.toLowerCase().includes(net.toLowerCase()));
  }

  private requiresFileSystemAccess(toolName: string): boolean {
    const fsTools = ['read', 'write', 'edit', 'create', 'delete', 'copy', 'move', 'grep', 'find'];
    return fsTools.some(fs => toolName.toLowerCase().includes(fs.toLowerCase()));
  }

  private hasFilePathParameter(toolName: string, parameters: any): boolean {
    if (!parameters || typeof parameters !== 'object') {
      return false;
    }

    const pathParams = ['file_path', 'path', 'filename', 'directory', 'target'];
    return pathParams.some(param => parameters.hasOwnProperty(param));
  }

  private extractFilePath(parameters: any): string | null {
    if (!parameters || typeof parameters !== 'object') {
      return null;
    }

    const pathParams = ['file_path', 'path', 'filename', 'directory', 'target'];
    for (const param of pathParams) {
      if (parameters[param] && typeof parameters[param] === 'string') {
        return parameters[param];
      }
    }

    return null;
  }

  private calculateToolRiskLevel(toolName: string): 'low' | 'medium' | 'high' | 'critical' {
    if (this.isDangerousTool(toolName)) return 'critical';
    if (this.isGitTool(toolName)) return 'high';
    if (this.isWriteTool(toolName)) return 'medium';
    return 'low';
  }

  private suggestAlternativeTools(
    toolName: string,
    permissions: ToolPermissions
  ): string[] {
    const alternatives: string[] = [];

    // Suggest read alternatives for write tools
    if (this.isWriteTool(toolName)) {
      const readAlternatives = ['read', 'grep', 'search'].filter(tool =>
        permissions.allowed.includes(tool)
      );
      alternatives.push(...readAlternatives);
    }

    // Suggest safe alternatives for dangerous tools
    if (this.isDangerousTool(toolName)) {
      const safeAlternatives = permissions.allowed.filter(tool =>
        !this.isDangerousTool(tool)
      );
      alternatives.push(...safeAlternatives.slice(0, 3)); // Limit suggestions
    }

    return alternatives;
  }

  private getReadOnlyAlternatives(toolName: string): string[] {
    const readOnlyAlternatives: Record<string, string[]> = {
      'write': ['read'],
      'edit': ['read', 'grep'],
      'create': ['search', 'find'],
      'delete': ['list', 'find'],
      'rm': ['ls', 'find']
    };

    return readOnlyAlternatives[toolName.toLowerCase()] || ['read', 'search'];
  }

  private recordViolation(violation: SecurityViolation): void {
    this.violations.push(violation);

    // Emit security event
    this.emit('security-violation', violation);

    // Log violation
    console.warn(`Security violation: ${violation.details}`, {
      agentId: violation.agentId,
      toolName: violation.toolName,
      severity: violation.severity,
      blocked: violation.blocked
    });

    // Trim violations if too many
    if (this.violations.length > 1000) {
      this.violations = this.violations.slice(-500);
    }
  }

  /**
   * Enhanced permission check with context
   */
  public checkToolPermissionWithContext(
    agentId: string,
    toolName: string,
    parameters: any,
    context: {
      taskType: string;
      iterationCount: number;
      previousTools: string[];
    }
  ): PermissionCheck {
    // First do basic permission check
    const basicCheck = this.checkToolPermission(agentId, toolName, parameters);

    if (!basicCheck.allowed) {
      return basicCheck;
    }

    // Additional context-based checks
    const contextCheck = this.checkContextualPermissions(
      agentId,
      toolName,
      parameters,
      context
    );

    return contextCheck.allowed ? basicCheck : contextCheck;
  }

  private checkContextualPermissions(
    agentId: string,
    toolName: string,
    parameters: any,
    context: any
  ): PermissionCheck {
    // Check for suspicious patterns
    if (this.detectSuspiciousPattern(context.previousTools, toolName)) {
      this.recordViolation({
        agentId,
        toolName,
        violationType: 'policy_violation',
        severity: 'medium',
        details: 'Suspicious tool usage pattern detected',
        timestamp: Date.now(),
        blocked: true
      });

      return {
        allowed: false,
        reason: 'Suspicious usage pattern detected',
        riskLevel: 'medium'
      };
    }

    // Check iteration limits for resource-intensive tools
    if (this.isResourceIntensiveTool(toolName) && context.iterationCount > 20) {
      return {
        allowed: false,
        reason: 'Resource-intensive tool usage limit reached',
        riskLevel: 'medium'
      };
    }

    return { allowed: true, riskLevel: 'low' };
  }

  private detectSuspiciousPattern(previousTools: string[], currentTool: string): boolean {
    // Detect repeated dangerous operations
    if (this.isDangerousTool(currentTool)) {
      const recentDangerous = previousTools.slice(-5).filter(tool => this.isDangerousTool(tool));
      if (recentDangerous.length > 2) return true;
    }

    // Detect rapid file system operations
    if (this.isWriteTool(currentTool)) {
      const recentWrites = previousTools.slice(-3).filter(tool => this.isWriteTool(tool));
      if (recentWrites.length >= 3) return true;
    }

    return false;
  }

  private isResourceIntensiveTool(toolName: string): boolean {
    const intensiveTools = ['search', 'find', 'grep', 'analyze', 'test'];
    return intensiveTools.includes(toolName.toLowerCase());
  }

  // Public query methods
  public getAgentPermissions(agentId: string): ToolPermissions | null {
    return this.agentPermissions.get(agentId) || null;
  }

  public getViolations(agentId?: string): SecurityViolation[] {
    if (agentId) {
      return this.violations.filter(v => v.agentId === agentId);
    }
    return [...this.violations];
  }

  public getSecurityStats(): SecurityStats {
    const totalViolations = this.violations.length;
    const criticalViolations = this.violations.filter(v => v.severity === 'critical').length;
    const blockedAttempts = this.violations.filter(v => v.blocked).length;

    const violationsByType: Record<string, number> = {};
    this.violations.forEach(v => {
      violationsByType[v.violationType] = (violationsByType[v.violationType] || 0) + 1;
    });

    return {
      totalViolations,
      criticalViolations,
      blockedAttempts,
      violationsByType,
      registeredAgents: this.agentPermissions.size,
      securityMode: this.config.get('MINI_AGENT_SECURITY_MODE', 'strict')
    };
  }

  public unregisterAgent(agentId: string): boolean {
    const existed = this.agentPermissions.has(agentId);
    this.agentPermissions.delete(agentId);

    if (existed) {
      this.emit('agent-unregistered', {
        agentId,
        timestamp: Date.now()
      });
    }

    return existed;
  }
}

interface SecurityStats {
  totalViolations: number;
  criticalViolations: number;
  blockedAttempts: number;
  violationsByType: Record<string, number>;
  registeredAgents: number;
  securityMode: string;
}
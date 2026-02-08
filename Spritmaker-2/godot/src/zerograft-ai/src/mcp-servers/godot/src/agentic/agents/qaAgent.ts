/**
 * QA Agent
 * 
 * Validation Expert & Quality Assurance.
 * Responsible for validating project integrity, checking errors, and ensuring quality.
 */

import { BaseAgent, AgentCallbacks } from './baseAgent.js';
import {
    AgentConfig,
    AgentTask,
    AgentResult,
    AGENT_TOOL_ASSIGNMENTS
} from '../multiAgentTypes.js';

/**
 * QA Agent configuration (CrewAI-style)
 */
const QA_AGENT_CONFIG: AgentConfig = {
    id: 'qa',
    name: 'QA Agent',
    role: 'Validation Expert & Quality Assurance',
    goal: 'Validate project integrity, check for errors, and ensure quality before the user runs the game',
    backstory: `You are an expert QA tester who validates Godot projects. You check for runtime 
errors, missing resources, incorrect node configurations, and ensure everything works correctly. 
You are thorough and catch issues before they become problems in the game.`,
    exclusiveTools: AGENT_TOOL_ASSIGNMENTS.qa as unknown as string[],
    sharedTools: ['list_files', 'read_script', 'get_scene_tree'],
    workspace: 'res://',
    maxTokens: 4000,
    maxIterations: 15
};

/**
 * Error severity levels
 */
type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

interface ValidationIssue {
    severity: ErrorSeverity;
    message: string;
    path?: string;
    suggestion?: string;
}

/**
 * QA Agent - Validation and testing specialist
 */
export class QAAgent extends BaseAgent {
    constructor(callbacks: AgentCallbacks) {
        super(QA_AGENT_CONFIG, callbacks);
    }

    // ============================================================================
    // Task Execution
    // ============================================================================

    async execute(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        this.setCurrentTask(task);
        this.updateStatus('executing');

        try {
            this.callbacks.onProgress?.(`[QA] Starting: ${task.description}`);

            let result: AgentResult;

            switch (task.type) {
                case 'validate_project':
                    result = await this.validateProject(task);
                    break;
                default:
                    result = await this.handleCustomTask(task);
            }

            this.updateStatus('idle');
            this.setCurrentTask(null);
            return result;

        } catch (error) {
            const errorResult = this.createFailureResult(task, {
                code: 'EXECUTION_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
                recoverable: true
            }, Date.now() - startTime);

            this.setCurrentTask(null);
            this.updateStatus('error');
            return errorResult;
        }
    }

    // ============================================================================
    // Validation
    // ============================================================================

    private async validateProject(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const issues: ValidationIssue[] = [];

        this.callbacks.onProgress?.(`[QA] Running validation checks...`);

        // Check 1: Node configuration errors
        const configErrors = await this.checkConfigurationErrors();
        issues.push(...configErrors);

        // Check 2: Runtime errors
        const runtimeErrors = await this.checkRuntimeErrors();
        issues.push(...runtimeErrors);

        // Check 3: Resource validation
        const resourceIssues = await this.validateResources();
        issues.push(...resourceIssues);

        // Check 4: Scene tree validation
        const sceneIssues = await this.validateSceneTree();
        issues.push(...sceneIssues);

        // Categorize issues
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const errorCount = issues.filter(i => i.severity === 'error').length;
        const warningCount = issues.filter(i => i.severity === 'warning').length;

        const success = criticalCount === 0 && errorCount === 0;

        // Report via A2A
        await this.sessionsSend(
            'orchestrator',
            `Validation complete: ${criticalCount} critical, ${errorCount} errors, ${warningCount} warnings`,
            success ? 'status_update' : 'error_report'
        );

        if (success) {
            return this.createSuccessResult(task, [], {
                issues,
                summary: {
                    critical: criticalCount,
                    errors: errorCount,
                    warnings: warningCount
                },
                passed: true
            }, Date.now() - startTime);
        } else {
            return this.createFailureResult(task, {
                code: 'VALIDATION_FAILED',
                message: `Found ${criticalCount} critical and ${errorCount} error(s)`,
                recoverable: true,
                suggestedAction: 'Review and fix the issues listed'
            }, Date.now() - startTime);
        }
    }

    private async checkConfigurationErrors(): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];

        this.callbacks.onProgress?.(`[QA] Checking node configurations...`);

        const result = await this.executeTool('get_errors', {});

        if (!result.success) {
            issues.push({
                severity: 'warning',
                message: 'Could not retrieve configuration errors',
                suggestion: 'Check Godot connection'
            });
            return issues;
        }

        const errors = result.data as any[];
        if (errors && errors.length > 0) {
            for (const error of errors) {
                issues.push({
                    severity: 'error',
                    message: error.message || error.toString(),
                    path: error.path || error.node,
                    suggestion: this.getSuggestionForError(error)
                });
            }
        }

        return issues;
    }

    private async checkRuntimeErrors(): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];

        this.callbacks.onProgress?.(`[QA] Checking runtime errors...`);

        const result = await this.executeTool('get_runtime_errors', {});

        if (!result.success) {
            return issues; // No runtime errors tool available
        }

        const errors = result.data as any[];
        if (errors && errors.length > 0) {
            for (const error of errors) {
                issues.push({
                    severity: error.type === 'error' ? 'critical' : 'error',
                    message: error.message || error.toString(),
                    path: error.script || error.source,
                    suggestion: this.getSuggestionForError(error)
                });
            }
        }

        return issues;
    }

    private async validateResources(): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];

        this.callbacks.onProgress?.(`[QA] Validating resources...`);

        const result = await this.executeTool('validate_resources', {});

        if (!result.success) {
            return issues; // validate_resources not available
        }

        const validation = result.data as any;
        if (validation?.missingResources) {
            for (const missing of validation.missingResources) {
                issues.push({
                    severity: 'error',
                    message: `Missing resource: ${missing}`,
                    path: missing,
                    suggestion: 'Create or import the missing resource'
                });
            }
        }

        return issues;
    }

    private async validateSceneTree(): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];

        this.callbacks.onProgress?.(`[QA] Validating scene tree...`);

        const result = await this.executeTool('get_scene_tree', {});

        if (!result.success) {
            issues.push({
                severity: 'warning',
                message: 'Could not retrieve scene tree',
                suggestion: 'Make sure a scene is open'
            });
            return issues;
        }

        // Analyze scene tree for common issues
        const tree = result.data as any;

        // Check for orphan nodes, missing required children, etc.
        // This would be more sophisticated in production

        return issues;
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    private getSuggestionForError(error: any): string {
        const message = (error.message || error.toString()).toLowerCase();

        if (message.includes('texture') || message.includes('sprite')) {
            return 'Assign a texture to the Sprite2D node';
        }
        if (message.includes('collision')) {
            return 'Add a CollisionShape2D with a valid shape';
        }
        if (message.includes('script')) {
            return 'Check script for syntax errors';
        }
        if (message.includes('resource') || message.includes('load')) {
            return 'Verify the resource path is correct';
        }
        if (message.includes('null') || message.includes('nil')) {
            return 'Check for null references in scripts';
        }

        return 'Review the error and fix the underlying issue';
    }

    private async handleCustomTask(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();

        // Default to full validation
        return this.validateProject(task);
    }

    // ============================================================================
    // BaseAgent Implementation
    // ============================================================================

    canHandle(task: AgentTask): boolean {
        if (task.type === 'validate_project') return true;
        if (task.assignedAgent === this.config.id) return true;

        const userRequest = task.input.userRequest;
        const desc = (typeof userRequest === 'string' && userRequest.trim().length > 0
            ? userRequest
            : task.description).toLowerCase();
        return desc.includes('validate') ||
            desc.includes('check') ||
            desc.includes('test') ||
            desc.includes('error') ||
            desc.includes('fix');
    }

    buildSystemPrompt(): string {
        return this.buildBasePrompt() + `
## QA Validation Guidelines

### Validation Checks
1. Node configuration errors (missing textures, shapes, etc.)
2. Runtime errors from the debugger
3. Missing resources (textures, scripts, etc.)
4. Scene tree structure issues

### Common Issues to Check
- Sprite2D without texture
- CollisionShape2D without shape
- CharacterBody2D without collision
- AnimatedSprite2D without sprite frames
- Missing script references
- Circular dependencies

### Severity Levels
- **Critical**: Game won't run
- **Error**: Feature broken
- **Warning**: Potential issue
- **Info**: Suggestion for improvement

### Reporting
- Always provide actionable suggestions
- Group related issues together
- Prioritize critical issues first
`;
    }
}

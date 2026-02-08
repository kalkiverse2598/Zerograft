/**
 * Agentic Callback Factory - Single source of truth for AgenticRouter callbacks
 * Eliminates duplicated callback definitions in aiRouter.ts
 */

import { WebSocket } from "ws";
import { AgenticRouterCallbacks } from "../agentic/index.js";
// Using v2 with native function calling
import { GeminiLLMv2 as GeminiLLM } from "../llm/geminiLLMv2.js";

export interface CallbackDependencies {
    executeTool: (name: string, params: Record<string, unknown>) => Promise<unknown>;
    getLLM: () => GeminiLLM;  // Changed from 'llm' to 'getLLM' to support dynamic model switching
    getSystemPrompt: () => string;
    pendingApprovals: Map<string, boolean>;
    pendingAnswers: Map<string, string>;
}

/**
 * Create AgenticRouter callbacks with optional WebSocket streaming
 */
export function createAgenticCallbacks(
    deps: CallbackDependencies,
    ws?: WebSocket
): AgenticRouterCallbacks {
    const startTime = Date.now();
    const getElapsed = () => ((Date.now() - startTime) / 1000).toFixed(1);

    // Helper for WebSocket sends
    const wsSend = (data: object) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    };

    return {
        executeTool: async (name, params) => {
            wsSend({ type: "status", text: `Executing: ${name}` });
            return deps.executeTool(name, params);
        },

        sendToLLMWithStream: async (systemPrompt, context, onThinking, onText, imageData) => {
            return new Promise((resolve) => {
                // Get the current LLM instance each time (supports model switching)
                deps.getLLM().processCommandStream(
                    context,
                    {
                        onThinking: (text) => {
                            if (onThinking) onThinking(text);
                        },
                        onText: (chunk) => {
                            if (onText) onText(chunk);
                        },
                        onComplete: (response) => resolve({
                            text: response.response,
                            // DEFENSIVE: Filter out commands without valid method names
                            toolCalls: (response.commands || [])
                                .filter(cmd => cmd && typeof cmd.method === 'string' && cmd.method.trim())
                                .map((cmd, i) => ({
                                    id: `tool_${Date.now()}_${i}`,
                                    name: cmd.method,
                                    params: cmd.params || {},
                                    timestamp: Date.now()
                                }))
                        }),
                        onError: (error) => resolve({ text: error.message, toolCalls: [] })
                    },
                    systemPrompt,
                    imageData
                );
            });
        },

        getSystemPrompt: deps.getSystemPrompt,

        onProgress: (msg) => {
            console.log(`[Agentic] ${msg}`);
            wsSend({ type: "status", text: msg });
        },

        onApprovalRequest: async (tool) => {
            // DEFENSIVE: Handle undefined tool
            const toolName = tool?.name || 'unknown';
            const toolParams = tool?.params || {};
            const toolId = `${toolName}_${Date.now()}`;

            // Extract friendly question text if provided (from multi-agent approval)
            const question = (toolParams as any)?.details || `Approve ${toolName}?`;

            console.log(`[Agentic] ⚠️ Approval needed for: ${toolName} (${toolId})`);

            wsSend({
                type: "approval_request",
                tool_id: toolId,
                tool: toolName,
                question: question,  // Friendly question for UI display
                params: toolParams
            });

            // Wait for approval response from UI
            const timeout = 60000;
            const pollInterval = 100;
            const waitStart = Date.now();

            while (Date.now() - waitStart < timeout) {
                if (deps.pendingApprovals.has(toolId)) {
                    const approved = deps.pendingApprovals.get(toolId)!;
                    deps.pendingApprovals.delete(toolId);
                    console.log(`[Agentic] Approval for ${toolId}: ${approved}`);
                    return approved;
                }
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            // Timeout - auto-approve and dismiss UI dialog
            console.log(`[Agentic] Approval timeout for ${toolId}, auto-approving`);
            wsSend({ type: "approval_acknowledged", tool_id: toolId, approved: true, message: "Auto-approved (timeout)" });
            return true;
        },

        onQuestion: async (params) => {
            const questionId = `question_${Date.now()}`;
            console.log(`[Agentic] ❓ Question: ${params.question} (${questionId})`);

            wsSend({
                type: "question",
                question_id: questionId,
                question: params.question,
                choices: params.choices,
                default: params.default,
                context_key: params.context_key
            });

            // Wait indefinitely for answer
            const pollInterval = 100;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (deps.pendingAnswers.has(questionId)) {
                    const answer = deps.pendingAnswers.get(questionId)!;
                    deps.pendingAnswers.delete(questionId);
                    console.log(`[Agentic] Answer for ${questionId}: ${answer}`);
                    return answer;
                }
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        },

        onStateChange: (state) => {
            console.log(`[Agentic] State: ${state}`);
            wsSend({ type: "state", state });
        },

        onComplete: (result) => {
            console.log(`[Agentic] ✅ Complete: ${(result.result || 'No result').substring(0, 100)}...`);
            const elapsed = getElapsed();
            wsSend({
                type: "done",
                response: result.result,
                results: [],
                artifacts: result.artifacts,
                elapsed
            });
        },

        onError: (error) => {
            console.error(`[Agentic] ❌ Error: ${error}`);
            wsSend({ type: "error", message: error });
        },

        onThinking: (text) => {
            if (!text) {
                wsSend({ type: "status", text: "Thinking..." });
            } else {
                const elapsed = getElapsed();
                wsSend({ type: "thought", chunk: text, elapsed });
            }
        },

        onText: (text) => {
            const elapsed = getElapsed();
            wsSend({ type: "text", chunk: text, elapsed });
        },

        onFileChange: (toolName, success, path) => {
            wsSend({
                type: "file_change",
                tool: toolName,
                success,
                path
            });
        },

        onDiff: (toolName, filePath, before, after) => {
            console.log(`[Agentic] Diff: ${toolName} ${filePath} (${before.length} -> ${after.length})`);
            wsSend({
                type: "diff",
                tool: toolName,
                path: filePath,
                before,
                after
            });
        },

        onAgentStatus: (name, role, state, progress) => {
            console.log(`[Agentic] Agent: ${name} (${role}) - ${state} ${progress * 100}%`);
            wsSend({
                type: "agent_status",
                name,
                role,
                state,
                progress
            });
        },

        onMultiAgentEnabled: (enabled) => {
            console.log(`[Agentic] Multi-agent mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
            wsSend({
                type: "multi_agent_enabled",
                enabled
            });
        },

        onPlanCreated: (plan) => {
            console.log(`[Agentic] Plan created with ${plan.tasks.length} tasks`);
            wsSend({
                type: "plan_created",
                plan_id: plan.id,
                tasks: plan.tasks.map(t => ({
                    id: t.id,
                    type: t.type,
                    description: t.description,
                    agent: t.assignedAgent,
                    status: t.status || 'pending'
                }))
            });
        }
    };
}

/**
 * Create minimal callbacks for non-WebSocket usage (console only)
 */
export function createConsoleCallbacks(
    deps: Omit<CallbackDependencies, 'pendingApprovals' | 'pendingAnswers'>
): AgenticRouterCallbacks {
    return createAgenticCallbacks({
        ...deps,
        pendingApprovals: new Map(),
        pendingAnswers: new Map()
    });
}

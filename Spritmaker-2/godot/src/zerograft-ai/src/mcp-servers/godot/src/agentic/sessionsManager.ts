/**
 * Sessions Manager
 * 
 * OpenClaw-inspired agent-to-agent communication.
 * Provides sessions_list, sessions_history, and sessions_send tools.
 */

import { randomUUID } from 'crypto';
import {
    SessionMessage,
    MessageType,
    AgentInfo,
    AgentState
} from './multiAgentTypes.js';

/**
 * Maximum messages to retain per session
 */
const MAX_MESSAGES_PER_SESSION = 100;

/**
 * Maximum total messages to retain
 */
const MAX_TOTAL_MESSAGES = 1000;

/**
 * Callback when an agent receives a message
 */
export type MessageHandler = (message: SessionMessage) => void;

/**
 * SessionsManager provides agent-to-agent communication (A2A)
 */
export class SessionsManager {
    private agents: Map<string, AgentInfo> = new Map();
    private messages: SessionMessage[] = [];
    private messageHandlers: Map<string, MessageHandler> = new Map();

    // ============================================================================
    // Agent Registration
    // ============================================================================

    /**
     * Register an agent with the sessions manager
     */
    registerAgent(agentInfo: AgentInfo): void {
        this.agents.set(agentInfo.id, agentInfo);
        console.log(`[SessionsManager] Agent registered: ${agentInfo.name} (${agentInfo.id})`);
    }

    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): void {
        this.agents.delete(agentId);
        this.messageHandlers.delete(agentId);
        console.log(`[SessionsManager] Agent unregistered: ${agentId}`);
    }

    /**
     * Update an agent's info
     */
    updateAgentInfo(agentId: string, update: Partial<AgentInfo>): void {
        const existing = this.agents.get(agentId);
        if (existing) {
            this.agents.set(agentId, { ...existing, ...update });
        }
    }

    /**
     * Register a message handler for an agent
     */
    onMessage(agentId: string, handler: MessageHandler): void {
        this.messageHandlers.set(agentId, handler);
    }

    // ============================================================================
    // Sessions Tools (OpenClaw Pattern)
    // ============================================================================

    /**
     * List all active agents and their status
     * 
     * @returns Array of agent info
     */
    sessionsList(): AgentInfo[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get message history for/from an agent
     * 
     * @param agentId - Agent to get history for
     * @param limit - Maximum messages to return
     * @returns Array of messages
     */
    sessionsHistory(agentId: string, limit: number = 10): SessionMessage[] {
        return this.messages
            .filter(m => m.to === agentId || m.from === agentId)
            .slice(-limit);
    }

    /**
     * Send a message to another agent
     * 
     * @param from - Sender agent ID
     * @param to - Recipient agent ID
     * @param content - Message content
     * @param type - Message type
     * @param payload - Optional additional data
     * @returns Message ID
     */
    sessionsSend(
        from: string,
        to: string,
        content: string,
        type: MessageType = 'task_request',
        payload?: Record<string, unknown>
    ): string {
        // Validate agents exist
        if (!this.agents.has(from)) {
            console.warn(`[SessionsManager] Unknown sender agent: ${from}`);
        }
        if (!this.agents.has(to)) {
            console.warn(`[SessionsManager] Unknown recipient agent: ${to}`);
        }

        const message: SessionMessage = {
            id: randomUUID(),
            from,
            to,
            content,
            type,
            timestamp: new Date(),
            payload
        };

        this.messages.push(message);
        this.pruneMessages();

        console.log(`[SessionsManager] Message sent: ${from} -> ${to} (${type})`);

        // Notify the recipient agent
        const handler = this.messageHandlers.get(to);
        if (handler) {
            try {
                handler(message);
            } catch (error) {
                console.error(`[SessionsManager] Message handler error for ${to}:`, error);
            }
        }

        return message.id;
    }

    /**
     * Send a reply to a previous message
     */
    sessionsReply(
        replyToMessageId: string,
        from: string,
        content: string,
        type: MessageType = 'response',
        payload?: Record<string, unknown>
    ): string | null {
        const originalMessage = this.messages.find(m => m.id === replyToMessageId);

        if (!originalMessage) {
            console.warn(`[SessionsManager] Original message not found: ${replyToMessageId}`);
            return null;
        }

        const message: SessionMessage = {
            id: randomUUID(),
            from,
            to: originalMessage.from, // Reply to sender
            content,
            type,
            timestamp: new Date(),
            replyTo: replyToMessageId,
            payload
        };

        this.messages.push(message);
        this.pruneMessages();

        console.log(`[SessionsManager] Reply sent: ${from} -> ${originalMessage.from}`);

        // Notify the recipient agent
        const handler = this.messageHandlers.get(originalMessage.from);
        if (handler) {
            try {
                handler(message);
            } catch (error) {
                console.error(`[SessionsManager] Reply handler error:`, error);
            }
        }

        return message.id;
    }

    // ============================================================================
    // Message Queries
    // ============================================================================

    /**
     * Get a specific message by ID
     */
    getMessage(messageId: string): SessionMessage | undefined {
        return this.messages.find(m => m.id === messageId);
    }

    /**
     * Get all messages between two agents
     */
    getConversation(agent1: string, agent2: string, limit: number = 50): SessionMessage[] {
        return this.messages
            .filter(m =>
                (m.from === agent1 && m.to === agent2) ||
                (m.from === agent2 && m.to === agent1)
            )
            .slice(-limit);
    }

    /**
     * Get unread messages for an agent (messages since last activity)
     */
    getUnreadMessages(agentId: string, since: Date): SessionMessage[] {
        return this.messages.filter(m =>
            m.to === agentId && m.timestamp > since
        );
    }

    /**
     * Get messages by type
     */
    getMessagesByType(type: MessageType, limit: number = 50): SessionMessage[] {
        return this.messages
            .filter(m => m.type === type)
            .slice(-limit);
    }

    // ============================================================================
    // Broadcast & Notifications
    // ============================================================================

    /**
     * Broadcast a message to all agents
     */
    broadcast(
        from: string,
        content: string,
        type: MessageType = 'status_update',
        excludeAgentIds: string[] = []
    ): string[] {
        const messageIds: string[] = [];

        for (const agent of Array.from(this.agents.values())) {
            if (agent.id !== from && !excludeAgentIds.includes(agent.id)) {
                const id = this.sessionsSend(from, agent.id, content, type);
                messageIds.push(id);
            }
        }

        console.log(`[SessionsManager] Broadcast from ${from} to ${messageIds.length} agents`);
        return messageIds;
    }

    /**
     * Send error report to orchestrator
     */
    reportError(
        agentId: string,
        error: string,
        context?: Record<string, unknown>
    ): void {
        // Find orchestrator agent
        const orchestrator = Array.from(this.agents.values())
            .find(a => a.role.toLowerCase().includes('orchestrator'));

        if (orchestrator) {
            this.sessionsSend(
                agentId,
                orchestrator.id,
                error,
                'error_report',
                context
            );
        } else {
            console.error(`[SessionsManager] No orchestrator to report error to: ${error}`);
        }
    }

    // ============================================================================
    // Cleanup
    // ============================================================================

    /**
     * Prune old messages to prevent memory growth
     */
    private pruneMessages(): void {
        if (this.messages.length > MAX_TOTAL_MESSAGES) {
            const toRemove = this.messages.length - MAX_TOTAL_MESSAGES;
            this.messages = this.messages.slice(toRemove);
            console.log(`[SessionsManager] Pruned ${toRemove} old messages`);
        }
    }

    /**
     * Clear all messages (for testing)
     */
    clearMessages(): void {
        this.messages = [];
    }

    /**
     * Clear all agents (for testing)
     */
    clearAgents(): void {
        this.agents.clear();
        this.messageHandlers.clear();
    }
}

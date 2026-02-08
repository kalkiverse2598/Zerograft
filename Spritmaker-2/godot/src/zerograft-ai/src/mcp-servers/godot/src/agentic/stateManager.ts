/**
 * State Manager
 * 
 * Manages shared project state with LangGraph-style checkpointing.
 * Enables time-travel debugging and safe rollback for file operations.
 */

import { randomUUID } from 'crypto';
import {
    ProjectState,
    SceneState,
    AssetState,
    LockInfo,
    Checkpoint,
    AgentState,
    TaskPlan,
    ConflictInfo
} from './multiAgentTypes.js';

/**
 * Maximum number of checkpoints to retain
 */
const MAX_CHECKPOINTS = 50;

/**
 * StateManager provides centralized state management with checkpointing
 */
export class StateManager {
    private state: ProjectState;
    private subscribers: Map<string, (state: ProjectState) => void>;

    constructor() {
        this.state = this.createInitialState();
        this.subscribers = new Map();
    }

    // ============================================================================
    // Initial State
    // ============================================================================

    private createInitialState(): ProjectState {
        return {
            version: 0,
            scenes: new Map(),
            assets: new Map(),
            locks: new Map(),
            agentStates: new Map(),
            currentPlan: null,
            checkpoints: []
        };
    }

    // ============================================================================
    // State Access
    // ============================================================================

    /**
     * Get a readonly copy of current state
     */
    getState(): Readonly<ProjectState> {
        return this.cloneState(this.state);
    }

    /**
     * Get current state version
     */
    getVersion(): number {
        return this.state.version;
    }

    /**
     * Get a specific scene's state
     */
    getSceneState(path: string): SceneState | undefined {
        return this.state.scenes.get(path);
    }

    /**
     * Get a specific asset's state
     */
    getAssetState(path: string): AssetState | undefined {
        return this.state.assets.get(path);
    }

    /**
     * Get an agent's state
     */
    getAgentState(agentId: string): AgentState | undefined {
        return this.state.agentStates.get(agentId);
    }

    /**
     * Get current task plan
     */
    getCurrentPlan(): TaskPlan | null {
        return this.state.currentPlan;
    }

    // ============================================================================
    // State Updates
    // ============================================================================

    /**
     * Update state with a partial patch
     */
    updateState(patch: Partial<ProjectState>): void {
        this.state = {
            ...this.state,
            ...patch,
            version: this.state.version + 1
        };
        this.notifySubscribers();
    }

    /**
     * Update a scene's state
     */
    updateSceneState(path: string, sceneState: SceneState): void {
        this.state.scenes.set(path, sceneState);
        this.state.version++;
        this.notifySubscribers();
    }

    /**
     * Update an asset's state
     */
    updateAssetState(path: string, assetState: AssetState): void {
        this.state.assets.set(path, assetState);
        this.state.version++;
        this.notifySubscribers();
    }

    /**
     * Update an agent's state
     */
    updateAgentState(agentId: string, agentState: AgentState): void {
        this.state.agentStates.set(agentId, agentState);
        this.state.version++;
        this.notifySubscribers();
    }

    /**
     * Set the current task plan
     */
    setCurrentPlan(plan: TaskPlan | null): void {
        this.state.currentPlan = plan;
        this.state.version++;
        this.notifySubscribers();
    }

    // ============================================================================
    // Checkpointing (LangGraph Pattern)
    // ============================================================================

    /**
     * Create a checkpoint of current state
     */
    createCheckpoint(label: string, agentId?: string): string {
        const checkpointId = randomUUID();

        const checkpoint: Checkpoint = {
            id: checkpointId,
            label,
            timestamp: new Date(),
            stateSnapshot: this.serializeState(this.state),
            agentId
        };

        this.state.checkpoints.push(checkpoint);

        // Prune old checkpoints if needed
        if (this.state.checkpoints.length > MAX_CHECKPOINTS) {
            this.state.checkpoints = this.state.checkpoints.slice(-MAX_CHECKPOINTS);
        }

        console.log(`[StateManager] Created checkpoint: ${label} (${checkpointId})`);
        return checkpointId;
    }

    /**
     * Rollback to a previous checkpoint
     */
    rollbackToCheckpoint(checkpointId: string): boolean {
        const checkpoint = this.state.checkpoints.find(c => c.id === checkpointId);

        if (!checkpoint) {
            console.error(`[StateManager] Checkpoint not found: ${checkpointId}`);
            return false;
        }

        try {
            const restoredState = this.deserializeState(checkpoint.stateSnapshot);

            // Keep checkpoints but update everything else
            this.state = {
                ...restoredState,
                checkpoints: this.state.checkpoints,
                version: this.state.version + 1
            };

            console.log(`[StateManager] Rolled back to checkpoint: ${checkpoint.label}`);
            this.notifySubscribers();
            return true;
        } catch (error) {
            console.error(`[StateManager] Failed to rollback:`, error);
            return false;
        }
    }

    /**
     * Get state history (checkpoints)
     */
    getStateHistory(limit: number = 10): Checkpoint[] {
        return this.state.checkpoints.slice(-limit);
    }

    /**
     * Get a specific checkpoint
     */
    getCheckpoint(checkpointId: string): Checkpoint | undefined {
        return this.state.checkpoints.find(c => c.id === checkpointId);
    }

    // ============================================================================
    // Conflict Detection
    // ============================================================================

    /**
     * Detect conflicts for resources an agent wants to access
     */
    detectConflicts(agentId: string, resources: string[]): ConflictInfo[] {
        const conflicts: ConflictInfo[] = [];

        for (const resource of resources) {
            const lock = this.state.locks.get(resource);

            if (lock && lock.agentId !== agentId) {
                // Check if lock is expired
                if (new Date() > lock.expiresAt) {
                    // Lock expired, can be cleaned up
                    this.state.locks.delete(resource);
                    continue;
                }

                conflicts.push({
                    resourcePath: resource,
                    conflictingAgentId: lock.agentId,
                    conflictType: lock.lockType === 'exclusive' ? 'write_write' : 'write_read',
                    resolution: 'wait'
                });
            }
        }

        return conflicts;
    }

    // ============================================================================
    // Lock Management Helpers
    // ============================================================================

    /**
     * Check if a resource is locked
     */
    isLocked(resourcePath: string): boolean {
        const lock = this.state.locks.get(resourcePath);
        if (!lock) return false;

        // Check expiration
        if (new Date() > lock.expiresAt) {
            this.state.locks.delete(resourcePath);
            return false;
        }

        return true;
    }

    /**
     * Get lock holder for a resource
     */
    getLockHolder(resourcePath: string): string | null {
        const lock = this.state.locks.get(resourcePath);
        if (!lock) return null;

        // Check expiration
        if (new Date() > lock.expiresAt) {
            this.state.locks.delete(resourcePath);
            return null;
        }

        return lock.agentId;
    }

    /**
     * Set a lock (called by LockManager)
     */
    setLock(lock: LockInfo): void {
        this.state.locks.set(lock.resourcePath, lock);
        this.state.version++;
    }

    /**
     * Remove a lock (called by LockManager)
     */
    removeLock(resourcePath: string): void {
        this.state.locks.delete(resourcePath);
        this.state.version++;
    }

    // ============================================================================
    // Subscription
    // ============================================================================

    /**
     * Subscribe to state changes
     */
    subscribe(id: string, callback: (state: ProjectState) => void): void {
        this.subscribers.set(id, callback);
    }

    /**
     * Unsubscribe from state changes
     */
    unsubscribe(id: string): void {
        this.subscribers.delete(id);
    }

    private notifySubscribers(): void {
        const stateCopy = this.cloneState(this.state);
        for (const callback of Array.from(this.subscribers.values())) {
            try {
                callback(stateCopy);
            } catch (error) {
                console.error('[StateManager] Subscriber error:', error);
            }
        }
    }

    // ============================================================================
    // Serialization
    // ============================================================================

    private serializeState(state: ProjectState): string {
        // Convert Maps to objects for JSON serialization
        const serializable = {
            ...state,
            scenes: Object.fromEntries(state.scenes),
            assets: Object.fromEntries(state.assets),
            locks: Object.fromEntries(state.locks),
            agentStates: Object.fromEntries(state.agentStates),
            checkpoints: [] // Don't include checkpoints in snapshot
        };
        return JSON.stringify(serializable);
    }

    private deserializeState(json: string): ProjectState {
        const parsed = JSON.parse(json);
        return {
            ...parsed,
            scenes: new Map(Object.entries(parsed.scenes)),
            assets: new Map(Object.entries(parsed.assets)),
            locks: new Map(Object.entries(parsed.locks)),
            agentStates: new Map(Object.entries(parsed.agentStates)),
            checkpoints: []
        };
    }

    private cloneState(state: ProjectState): ProjectState {
        return {
            ...state,
            scenes: new Map(state.scenes),
            assets: new Map(state.assets),
            locks: new Map(state.locks),
            agentStates: new Map(state.agentStates),
            checkpoints: [...state.checkpoints]
        };
    }
}

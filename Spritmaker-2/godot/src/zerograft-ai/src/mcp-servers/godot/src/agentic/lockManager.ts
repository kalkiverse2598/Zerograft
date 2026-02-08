/**
 * Lock Manager
 * 
 * Token-based locking for conflict resolution between agents.
 * Prevents concurrent file modifications that could corrupt project state.
 */

import { randomUUID } from 'crypto';
import { LockInfo, LockType } from './multiAgentTypes.js';
import { StateManager } from './stateManager.js';

/**
 * Default lock timeout in milliseconds (5 minutes)
 */
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * How often to check for stale locks (1 minute)
 */
const LOCK_CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * LockManager provides token-based locking for multi-agent coordination
 */
export class LockManager {
    private stateManager: StateManager;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(stateManager: StateManager) {
        this.stateManager = stateManager;
        this.startCleanupTask();
    }

    // ============================================================================
    // Lock Acquisition
    // ============================================================================

    /**
     * Acquire a lock on a resource
     * 
     * @param agentId - Agent requesting the lock
     * @param resourcePath - Path to the resource to lock
     * @param type - Lock type (exclusive for write, shared for read)
     * @param operation - Description of the operation
     * @param timeoutMs - Lock timeout in milliseconds
     * @returns true if lock acquired, false otherwise
     */
    async acquireLock(
        agentId: string,
        resourcePath: string,
        type: LockType,
        operation: string,
        timeoutMs: number = DEFAULT_LOCK_TIMEOUT_MS
    ): Promise<boolean> {
        const existingLock = this.getLock(resourcePath);

        if (existingLock) {
            // Check if lock is held by the same agent
            if (existingLock.agentId === agentId) {
                // Already have the lock, extend it
                return this.extendLock(agentId, resourcePath, timeoutMs);
            }

            // Check if lock is expired
            if (new Date() > existingLock.expiresAt) {
                // Lock expired, release and acquire
                this.releaseLock(existingLock.agentId, resourcePath);
            } else {
                // Lock is still valid and held by another agent
                if (type === 'exclusive' || existingLock.lockType === 'exclusive') {
                    // Conflict: exclusive lock requested or existing lock is exclusive
                    console.log(`[LockManager] Lock conflict on ${resourcePath}: ` +
                        `${agentId} wants ${type}, ${existingLock.agentId} holds ${existingLock.lockType}`);
                    return false;
                }
                // Both are shared locks, can coexist (but we use simple model for now)
                // In a more complex system, we'd track multiple shared lock holders
            }
        }

        // Create the lock
        const lock: LockInfo = {
            resourcePath,
            agentId,
            lockType: type,
            acquiredAt: new Date(),
            expiresAt: new Date(Date.now() + timeoutMs),
            operation
        };

        this.stateManager.setLock(lock);
        console.log(`[LockManager] Lock acquired: ${agentId} -> ${resourcePath} (${type})`);
        return true;
    }

    /**
     * Try to acquire lock with retries
     */
    async acquireLockWithRetry(
        agentId: string,
        resourcePath: string,
        type: LockType,
        operation: string,
        maxRetries: number = 3,
        retryDelayMs: number = 1000
    ): Promise<boolean> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const acquired = await this.acquireLock(agentId, resourcePath, type, operation);
            if (acquired) {
                return true;
            }

            if (attempt < maxRetries - 1) {
                console.log(`[LockManager] Lock attempt ${attempt + 1} failed, retrying in ${retryDelayMs}ms`);
                await this.delay(retryDelayMs);
            }
        }

        console.log(`[LockManager] Failed to acquire lock after ${maxRetries} attempts`);
        return false;
    }

    /**
     * Acquire locks on multiple resources atomically
     */
    async acquireMultipleLocks(
        agentId: string,
        resources: string[],
        type: LockType,
        operation: string
    ): Promise<boolean> {
        const acquiredLocks: string[] = [];

        try {
            for (const resource of resources) {
                const acquired = await this.acquireLock(agentId, resource, type, operation);
                if (!acquired) {
                    // Release all previously acquired locks
                    for (const locked of acquiredLocks) {
                        this.releaseLock(agentId, locked);
                    }
                    return false;
                }
                acquiredLocks.push(resource);
            }
            return true;
        } catch (error) {
            // Release all acquired locks on error
            for (const locked of acquiredLocks) {
                this.releaseLock(agentId, locked);
            }
            throw error;
        }
    }

    // ============================================================================
    // Lock Release
    // ============================================================================

    /**
     * Release a lock on a resource
     */
    releaseLock(agentId: string, resourcePath: string): boolean {
        const lock = this.getLock(resourcePath);

        if (!lock) {
            console.warn(`[LockManager] No lock to release on ${resourcePath}`);
            return false;
        }

        if (lock.agentId !== agentId) {
            console.warn(`[LockManager] Agent ${agentId} cannot release lock held by ${lock.agentId}`);
            return false;
        }

        this.stateManager.removeLock(resourcePath);
        console.log(`[LockManager] Lock released: ${agentId} -> ${resourcePath}`);
        return true;
    }

    /**
     * Release all locks held by an agent
     */
    releaseAllLocks(agentId: string): number {
        const state = this.stateManager.getState();
        const toRelease: string[] = [];

        for (const [path, lock] of Array.from(state.locks.entries())) {
            if (lock.agentId === agentId) {
                toRelease.push(path);
            }
        }

        for (const path of toRelease) {
            this.stateManager.removeLock(path);
        }

        console.log(`[LockManager] Released ${toRelease.length} locks for agent ${agentId}`);
        return toRelease.length;
    }

    // ============================================================================
    // Lock Extension
    // ============================================================================

    /**
     * Extend the timeout of an existing lock
     */
    extendLock(
        agentId: string,
        resourcePath: string,
        additionalTimeMs: number = DEFAULT_LOCK_TIMEOUT_MS
    ): boolean {
        const lock = this.getLock(resourcePath);

        if (!lock) {
            console.warn(`[LockManager] No lock to extend on ${resourcePath}`);
            return false;
        }

        if (lock.agentId !== agentId) {
            console.warn(`[LockManager] Agent ${agentId} cannot extend lock held by ${lock.agentId}`);
            return false;
        }

        const extendedLock: LockInfo = {
            ...lock,
            expiresAt: new Date(Date.now() + additionalTimeMs)
        };

        this.stateManager.setLock(extendedLock);
        console.log(`[LockManager] Lock extended: ${agentId} -> ${resourcePath}`);
        return true;
    }

    // ============================================================================
    // Lock Status
    // ============================================================================

    /**
     * Check if a resource is locked
     */
    isLocked(resourcePath: string): boolean {
        return this.stateManager.isLocked(resourcePath);
    }

    /**
     * Get the lock holder for a resource
     */
    getLockHolder(resourcePath: string): string | null {
        return this.stateManager.getLockHolder(resourcePath);
    }

    /**
     * Get lock info for a resource
     */
    getLock(resourcePath: string): LockInfo | undefined {
        const state = this.stateManager.getState();
        return state.locks.get(resourcePath);
    }

    /**
     * Get all locks held by an agent
     */
    getLocksForAgent(agentId: string): LockInfo[] {
        const state = this.stateManager.getState();
        const locks: LockInfo[] = [];

        for (const lock of Array.from(state.locks.values())) {
            if (lock.agentId === agentId) {
                locks.push(lock);
            }
        }

        return locks;
    }

    /**
     * Get all active locks
     */
    getAllLocks(): LockInfo[] {
        const state = this.stateManager.getState();
        return Array.from(state.locks.values());
    }

    // ============================================================================
    // Cleanup
    // ============================================================================

    /**
     * Start the automatic cleanup task
     */
    private startCleanupTask(): void {
        this.cleanupInterval = setInterval(() => {
            this.expireStaleLocks();
        }, LOCK_CLEANUP_INTERVAL_MS);
    }

    /**
     * Stop the automatic cleanup task
     */
    stopCleanupTask(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Expire stale locks
     */
    expireStaleLocks(): number {
        const state = this.stateManager.getState();
        const now = new Date();
        const expired: string[] = [];

        for (const [path, lock] of Array.from(state.locks.entries())) {
            if (now > lock.expiresAt) {
                expired.push(path);
            }
        }

        for (const path of expired) {
            console.log(`[LockManager] Expiring stale lock: ${path}`);
            this.stateManager.removeLock(path);
        }

        if (expired.length > 0) {
            console.log(`[LockManager] Expired ${expired.length} stale locks`);
        }

        return expired.length;
    }

    // ============================================================================
    // Helpers
    // ============================================================================

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

import { NodeExecutor, NodeCategory } from '../types';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Central registry for all node types
 * Provides lookup, validation, and instantiation of node executors
 */
export class NodeRegistry {
  private executors: Map<string, NodeExecutor> = new Map();

  /**
   * Register a node executor
   */
  register(executor: NodeExecutor): void {
    if (this.executors.has(executor.type)) {
      devDiagnostics.warn(`Node type ${executor.type} is already registered. Overwriting...`);
    }
    this.executors.set(executor.type, executor);
  }

  /**
   * Register multiple executors at once
   */
  registerMany(executors: NodeExecutor[]): void {
    executors.forEach((executor) => this.register(executor));
  }

  /**
   * Get executor by type
   */
  getExecutor(type: string): NodeExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`Node type ${type} not found in registry`);
    }
    return executor;
  }

  /**
   * Check if a node type is registered
   */
  hasExecutor(type: string): boolean {
    return this.executors.has(type);
  }

  /**
   * Get all registered executors
   */
  getAllExecutors(): NodeExecutor[] {
    return Array.from(this.executors.values());
  }

  /**
   * Get executors by category
   */
  getExecutorsByCategory(category: NodeCategory): NodeExecutor[] {
    return this.getAllExecutors().filter((executor) => executor.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(): NodeCategory[] {
    const categories = new Set<NodeCategory>();
    this.getAllExecutors().forEach((executor) => {
      categories.add(executor.category);
    });
    return Array.from(categories);
  }

  /**
   * Clear all registered executors
   */
  clear(): void {
    this.executors.clear();
  }

  /**
   * Get count of registered executors
   */
  get count(): number {
    return this.executors.size;
  }
}

// Global singleton instance
export const nodeRegistry = new NodeRegistry();

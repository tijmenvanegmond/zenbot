import { EventEmitter } from 'events';

export interface CommandInput {
  readonly type: 'voice' | 'slash' | 'internal';
  readonly text: string;
  readonly userId: string;
  readonly metadata: Record<string, any>;
}

export class CommandInput {
  constructor(
    public readonly type: 'voice' | 'slash' | 'internal',
    public readonly text: string,
    public readonly userId: string,
    public readonly metadata: Record<string, any> = {}
  ) {}

  static fromVoice(text: string, userId: string): CommandInput {
    return new CommandInput('voice', text, userId);
  }

  static fromSlash(commandName: string, options: any, userId: string): CommandInput {
    return new CommandInput('slash', commandName, userId, { options });
  }

  static create(type: 'internal', command: string, metadata: Record<string, any> = {}): CommandInput {
    return new CommandInput(type, command, 'system', metadata);
  }
}

export interface CommandContext {
  readonly userId: string;
  readonly channelId: string;
  readonly inputType: 'voice' | 'slash' | 'internal';
  readonly sessionId?: string;
  readonly options: Record<string, any>;
  
  getOption<T>(key: string, defaultValue?: T): T;
  getText(): string;
  isInListeningSession(): boolean;
  withConcurrentMode(): CommandContext;
}

export class CommandContext {
  constructor(
    public readonly userId: string,
    public readonly channelId: string,
    public readonly inputType: 'voice' | 'slash' | 'internal',
    public readonly options: Record<string, any> = {},
    public readonly sessionId?: string,
    private readonly concurrentMode = false
  ) {}

  getOption<T>(key: string, defaultValue?: T): T {
    return this.options[key] ?? defaultValue;
  }

  getText(): string {
    return this.options.text || '';
  }

  isInListeningSession(): boolean {
    return !!this.sessionId;
  }

  withConcurrentMode(): CommandContext {
    return new CommandContext(
      this.userId,
      this.channelId, 
      this.inputType,
      this.options,
      this.sessionId,
      true
    );
  }

  getConcurrentMode(): boolean {
    return this.concurrentMode;
  }

  static fromVoice(userId: string, channelId: string, sessionId?: string): CommandContext {
    return new CommandContext(userId, channelId, 'voice', {}, sessionId);
  }

  static fromSlash(userId: string, channelId: string, options: Record<string, any>): CommandContext {
    return new CommandContext(userId, channelId, 'slash', options);
  }
}

export class CommandResult {
  constructor(
    public readonly success: boolean,
    public readonly response: string,
    public readonly data: Record<string, any> = {}
  ) {}

  static success(response: string, data: Record<string, any> = {}): CommandResult {
    return new CommandResult(true, response, data);
  }

  static notFound(message = "Command not understood"): CommandResult {
    return new CommandResult(false, message);
  }

  static error(message: string): CommandResult {
    return new CommandResult(false, message);
  }
}

export abstract class Command {
  constructor(
    protected commandRegistry?: any, // Will be CommandRegistry
    protected eventBus?: EventEmitter
  ) {}

  abstract readonly name: string;
  abstract readonly description: string;
  
  abstract canHandle(input: CommandInput): boolean;
  abstract execute(context: CommandContext): Promise<CommandResult>;

  // Optional method for Discord slash command registration
  getSlashCommandData?(): {
    name: string;
    description: string;
    options?: any[];
  };

  // Command composition - commands can call other commands
  protected async invokeCommand(input: CommandInput, context: CommandContext): Promise<CommandResult> {
    if (!this.commandRegistry) {
      return CommandResult.error("Command registry not available");
    }
    
    // Create new context that merges input metadata with existing context options
    const newContext = new CommandContext(
      input.userId || context.userId,
      input.metadata.channelId || context.channelId,
      input.type,
      { ...context.options, ...input.metadata }, // Merge metadata into options!
      context.sessionId,
      context.getConcurrentMode()
    );
    
    return await this.commandRegistry.executeCommand(input, newContext);
  }

  // Event emission - commands can emit events for infrastructure
  protected emit(event: string, data: any): void {
    this.eventBus?.emit(event, data);
  }
}
import { Logger as TSLog, ILogObj, ISettingsParam, ILogObjMeta } from "tslog";
if (typeof window === "undefined") {
  globalThis.window = globalThis as Window & typeof globalThis;
}

/**
 * Logger
 * 
 * This class is a wrapper around the TSLog class that provides a more convenient way to create
 * loggers with a specific scope and settings.
 */
export class Logger extends TSLog<ILogObj> {
  /**
   * Creates an instance of Logger.
   * @param scope - The scope of the logger.
   * @param settings - The settings for the logger.
   * @see {@link https://tslog.js.org/interfaces/isettingsparam.html}
   */
  constructor(scope = "vh", settings: ISettingsParam<ILogObj> = {}) {
    settings.name = scope;
    settings.minLevel = settings.minLevel || 0;

    super(settings);
  }

  /**
   * Log a message to the console.
   * 
   * This function will only log messages if the logger is in debug mode.
   * 
   * @param logLevelId - The log level id.
   * @param logLevelName - The log level name.
   * @param args - The arguments to log.
   * @returns The log object.
   * @see {@link https://tslog.js.org/interfaces/ilogobj.html}
   * @see {@link https://tslog.js.org/interfaces/ilogobjmeta.html}
   */
  log(logLevelId: number, logLevelName: string, ...args: unknown[]): (ILogObj & ILogObjMeta) | undefined {
    if (this.isDebugEnabled()) {
      return super.log(logLevelId, logLevelName, ...args);
    }
  }

  /**
   * Check if the logger is in debug mode.
   * 
   * If the DEBUG variable / environmental variable is set, and the namespace matches a
   * pattern, then we are in debug mode and we will log all messages. Otherwise, the log
   * messages will not be displayed.
   * 
   * @returns true if the logger is in debug mode, false otherwise.
   */
  isDebugEnabled(): boolean {
    const DEBUG = (globalThis as any)?.DEBUG as string || window?.DEBUG || process?.env?.DEBUG || "";
    if (DEBUG === "") {
      return false;
    }

    const scope: string[] = [];
    this.settings.parentNames?.forEach((name: string) => {
      scope.push(name);
    });
    if (this.settings.name) {
      scope.push(this.settings.name);
    }

    const namespace = scope.join(":");
    // regex pattern to match the namespace(s) we want to log, e.g. "*, scope:*, scope:child:*, scope:child:grandchild:*. etc."
    const pattern = new RegExp(DEBUG.replace(/\*/g, ".*").replace(/:/g, "\\:"));
    return DEBUG !== "" && (DEBUG === "*" || pattern.test(namespace));
  }

  /**
   * Get a sub logger with a specific scope.
   * 
   * @param scope - The scope.
   * @returns The sub logger.
   */
  scope(scope: string): Logger {
    const settings = structuredClone(this.settings);
    settings.parentNames = settings.parentNames || [];
    settings.parentNames.push(settings.name || "");

    return new Logger(scope, settings);
  }
}

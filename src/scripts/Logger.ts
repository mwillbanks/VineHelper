import { Logger as TSLog, ILogObj, ISettingsParam } from "tslog";

export class Logger extends TSLog<ILogObj> {
  constructor(scope = "vh", settings: ISettingsParam<ILogObj> = {}) {
    settings.name = scope;
    settings.minLevel = settings.minLevel || 0;

    super(settings);
  }

  isDebugEnabled() : boolean {
    const DEBUG = window.DEBUG || process?.env?.DEBUG || "";

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

  scope(scope: string): Logger {
    return this.getSubLogger({ name: scope }) as Logger;
  }
}

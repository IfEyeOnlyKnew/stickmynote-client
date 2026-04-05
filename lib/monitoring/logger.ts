import fs from "node:fs"
import path from "node:path"

type LogLevel = "info" | "warn" | "error" | "debug"

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: Error
}

class Logger {
  private readonly logDir: string
  private readonly enableFileLogging: boolean

  constructor() {
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), "logs")
    this.enableFileLogging = process.env.NODE_ENV === "production"

    if (this.enableFileLogging) {
      this.ensureLogDirectory()
    }
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`
    const context = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : ""
    const error = entry.error ? ` | Error: ${entry.error.message}\n${entry.error.stack}` : ""
    return base + context + error
  }

  private writeToFile(level: LogLevel, entry: LogEntry) {
    if (!this.enableFileLogging) return

    const filename = path.join(this.logDir, `${level}.log`)
    const logLine = this.formatLogEntry(entry) + "\n"

    try {
      fs.appendFileSync(filename, logLine)
    } catch (error) {
      console.error("Failed to write to log file:", error)
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    }

    // Console output
    const consoleMessage = this.formatLogEntry(entry)
    switch (level) {
      case "error":
        console.error(consoleMessage)
        break
      case "warn":
        console.warn(consoleMessage)
        break
      case "debug":
        console.debug(consoleMessage)
        break
      default:
        console.log(consoleMessage)
    }

    // File output
    this.writeToFile(level, entry)
    if (level === "error") {
      this.writeToFile("error", entry) // Errors go to both files
    }
  }

  info(message: string, context?: Record<string, any>) {
    this.log("info", message, context)
  }

  warn(message: string, context?: Record<string, any>) {
    this.log("warn", message, context)
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log("error", message, context, error)
  }

  debug(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV === "development") {
      this.log("debug", message, context)
    }
  }
}

export const logger = new Logger()

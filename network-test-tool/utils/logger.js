const chalk = require('chalk');

// Helper function to get timestamp for logging (time only, no date)
function getTimestamp() {
  return new Date().toISOString().substring(11, 19); // HH:MM:SS only
}

// Enhanced console.log with timestamp
function logWithTime(message, color = chalk.white) {
  const timestamp = chalk.gray(`[${getTimestamp()}]`);
  if (typeof color === 'function') {
    console.log(`${timestamp} ${color(message)}`);
  } else {
    console.log(`${timestamp} ${message}`);
  }
}

// Convenience methods for different log levels
const logger = {
  info: (...args) => {
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.blue(args.join(' ')));
  },
  success: (...args) => {
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.green(args.join(' ')));
  },
  warning: (...args) => {
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.yellow(args.join(' ')));
  },
  error: (...args) => {
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.red(args.join(' ')));
  },
  log: (...args) => {
    // Skip timestamp for empty lines or whitespace-only content
    if (args.length === 0 || (args.length === 1 && args[0].toString().trim() === '')) {
      console.log(...args);
      return;
    }
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, ...args);
  },
  cyan: (...args) => {
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.cyan(args.join(' ')));
  },
  gray: (...args) => {
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.gray(args.join(' ')));
  },
  white: (...args) => {
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp, chalk.white(args.join(' ')));
  },
  
  // For table output and other complex logs, show single timestamp then raw content
  table: (content) => {
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    console.log(timestamp); // Single timestamp on its own line
    console.log(content.toString()); // Raw table content without timestamps
  },
  
  // For preserving original console.log behavior when needed
  raw: console.log.bind(console),
  
  // For blank lines without timestamp
  blank: () => {
    console.log();
  }
};

module.exports = { getTimestamp, logWithTime, logger };
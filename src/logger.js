import { createLogger, format, transports } from 'winston'

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.colorize(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
      return `${timestamp} [${level}] ${message}${extra}`
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: 'data/echomind.log',
      format: format.combine(format.timestamp(), format.json()),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 3,
    }),
  ],
})

export default logger

const winston = require('winston');
const LokiTransport = require('winston-loki');

module.exports = {
  sqlLogger: winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
      new LokiTransport({
        host: process.env.LOKI_HOST,
        labels: { type: 'sql' },
      }),
      new winston.transports.File({ filename: `${process.env.LOG_FOLDER}/sql.log`, level: 'silly' }),
    ],
  }),
};

const amqp = require('amqp-connection-manager');
const path = require('path');
const logstashWinston = require('logstash-winston');

global.logger = logstashWinston.logger;

const env = process.env.NODE_ENV || 'development';
const currentPath = process.cwd();

const config = require(path.join(currentPath, 'config', 'env', `${env}`));

const {
    host,
    port,
    username,
    password,
    vhost = '/',
    protocol = 'amqp',
    prefetch = 2,
    heartbeatInterval = 5,
    reconnectTime = 10,
    options = {},
    defaultQueueFeatures = { durable: true }
} = config.rabbitMQ;

const connectionUrl = `${protocol}://${username}:${password}@${host}:${port}/${vhost}`;

/**
 * options.heartbeatIntervalInSeconds - Interval to send heartbeats to broker. Defaults to 5 seconds.
 * options.reconnectTimeInSeconds - The time to wait before trying to reconnect. If not specified, defaults to heartbeatIntervalInSeconds.
 * options.findServers(callback) is a function which returns one or more servers to connect to. This should return either a single URL or an array of URLs. This is handy when you're using a service discovery mechanism such as Consul or etcd. Instead of taking a callback, this can also return a Promise. Note that if this is supplied, then urls is ignored.
 * options.connectionOptions is passed as options to the amqplib connect method.
 */

// Create a connetion manager
const connection = amqp.connect(
  [connectionUrl],
  {
    json: true,
    heartbeatIntervalInSeconds: heartbeatInterval,
    reconnectTimeInSeconds: reconnectTime,
    connectionOptions: options
  }
);

connection.on('connect', () => {
  logger.log('data', { note: 'Connected to RabbitMQ server' });
});

connection.on('disconnect', params => {
  logger.log('error', { error: params.err, note: 'RabbitMQ server is disconnected' });
});

/**
 *  Consumer.
 *
 * @param {object} params - object with queue name and queue options.
 * @param {function} [handler] - callback.
 * @returns {void | Promise} - Resolves when complete.
 */
const consume = (params = {}, handler) => {
  const queueName = params.queue && params.queue.name;
  const queueOptions = params.queue.options || defaultQueueFeatures;

  if (!queueName) {
    return Promise.reject(new Error('Queue name is missing'));
  }

  // Set up a channel listening for messages in the queue.
  const channelWrapper = connection.createChannel({
    setup(channel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      return Promise.all([
        channel.assertQueue(queueName, queueOptions),
        channel.prefetch(prefetch),
        channel.consume(
          queueName,
          data => {
            const message = JSON.parse(data.content.toString());

            handler(message).then(() => channelWrapper.ack(data)).catch(() => {});
          },
          { noAck: false }
        )
      ]).catch(e => {
        logger.log('error', { error: e, note: 'error from consume' });
      });
    }
  });

  /** start the consumer */
  return channelWrapper.waitForConnect().then(() => {
    logger.log('data', { note: `Consumption from ${queueName} started!` });
  });
};

/**
 *  Publisher.
 *
 * @param {object} params - object with queue name and queue options.
 * @param {object} [data] - data to be published.
 * @returns {void | Promise} - Resolves when complete.
 */
const publish = (params = {}, data) => {
  const queueName = params.queue && params.queue.name;
  const queueOptions = params.queue.options || defaultQueueFeatures;

  if (!queueName) {
    return Promise.reject(new Error('Queue name is missing'));
  }

  const channelWrapper = connection.createChannel({
    json: true,
    setup(channel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      return channel.assertQueue(queueName, queueOptions);
    }
  });

  const startPublishing = () => {
    channelWrapper
      .sendToQueue(queueName, data, { persistent: true })
      .then(() => {
        logger.log('data', { note: `Message sent to queue ${queueName}` });
        return Promise.resolve(data);
      })
      .catch(err => {
        logger.log('error', { note: 'Message was rejected', error: err, custom: { data }});
        channelWrapper.close();
        connection.close();
      });
  };

  startPublishing();
};

/**
 *  purgeQueue.
 *
 * @param {object} params - object with queue name and queue options.
 * @returns {void | Promise} - Resolves when complete.
 */
const purgeQueue = (params ={}) => {
  const queueName = params.queue && params.queue.name;
  const queueOptions = params.queue.options || defaultQueueFeatures;

  if (!queueName) {
    return Promise.reject(new Error('Queue name is missing'));
  }

  const channelWrapper = connection.createChannel({
    setup(channel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      return Promise.all([
        channel.assertQueue(queueName, queueOptions),
        channel.purgeQueue(queueName)
      ]);
    }
  });

  return channelWrapper;
};

/**
 *  ackAll.
 *
 * @returns {void | Promise} - Resolves when complete.
 */
const ackAll = () => {
  const channelWrapper = connection.createChannel({
    setup(channel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      return channel.ackAll();
    }
  });

  return channelWrapper;
};

module.exports = {
  publish,
  consume,
  purgeQueue,
  ackAll
};

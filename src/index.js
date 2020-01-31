/* eslint-disable no-console */
import amqp from 'amqp-connection-manager';

const logger = global.logger || { log: console.log, error: console.error };
 
export default class RabbitMQ {
  constructor({
    host,
    port,
    username,
    password,
    vhost = '/',
    protocol = 'amqp',
    prefetch = 2,
    heartbeatInterval = 5,                    // Interval to send heartbeats to broker. Defaults to 5 seconds.
    reconnectTime = 10,                       // The time to wait before trying to reconnect. If not specified, defaults to heartbeatIntervalInSeconds.
    options = {},                             // options.findServers(callback) is a function which returns one or more servers to connect to. This should return either a single URL or an array of URLs. This is handy when you're using a service discovery mechanism such as Consul or etcd. Instead of taking a callback, this can also return a Promise. Note that if this is supplied, then urls is ignored.
    defaultQueueFeatures = { durable: true }  // options.connectionOptions is passed as options to the amqplib connect method.
  }) {
    this.host = host,
    this.port = port,
    this.username = username,
    this.password = password,
    this.vhost = vhost,
    this.protocol = protocol,
    this.prefetch = prefetch,
    this.heartbeatInterval = heartbeatInterval,
    this.reconnectTime = reconnectTime,
    this.options = options,
    this.defaultQueueFeatures = defaultQueueFeatures;
    
    this.connectionUrl = `${this.protocol}://${this.username}:${this.password}@${this.host}:${this.port}/${this.vhost}`;

    // Create a connetion manager
    this.connection = amqp.connect(
      [this.connectionUrl],
      {
        json: true,
        heartbeatIntervalInSeconds: this.heartbeatInterval,
        reconnectTimeInSeconds: this.reconnectTime,
        connectionOptions: this.options
      }
    );

    this.connection.on('connect', () => {
      logger.log('data', { note: 'Connected to RabbitMQ server' });
    });

    this.connection.on('disconnect', params => {
      logger.log('error', { error: params.err, note: 'RabbitMQ server is disconnected' });
    });

    // bind the 'this' context to all the methods
    this.consume = this.consume.bind(this);
    this.publish = this.publish.bind(this);
    this.purgeQueue = this.purgeQueue.bind(this);
    this.ackAll = this.ackAll.bind(this);
  }

  /**
   *  Consumer.
   *
   * @param {object} params - object with queue name and queue options.
   * @param {function} [handler] - callback.
   * @returns {void | Promise} - Resolves when complete.
   */
  consume({ queue: { name, options = {} } = {}}, handler) {
    const queueName = name;
    const queueOptions = options ? { ...options, ...this.defaultQueueFeatures } : this.defaultQueueFeatures;

    if (!queueName) {
      return Promise.reject(new Error('Queue name is missing'));
    }

    const channelWrapper = this.connection.createChannel({
      setup(channel) {
        /** `channel` here is a regular amqplib `ConfirmChannel`. */
        return Promise.all([
          channel.assertQueue(queueName, queueOptions),
          channel.prefetch(this.prefetch),
          channel.consume(
            queueName,
            data => {
              let message;
              try {
                message = JSON.parse(data.content.toString());
  
                return handler(message, { queue: { name, options }})
                  .then(() => {
                    channelWrapper.ack(data);
                    return Promise.resolve(data);
                  });
              } catch (error) {
                logger.log('error', {
                  error,
                  note: `Got malformed message from queue ${queueName}`,
                  custom: { data: message }
                });
  
                return Promise.reject(error, data);
              }
            },
            { noAck: false }
          )
        ])
        /** catch all errors */
          .catch(e => {
            logger.log('error', { error: e, note: 'error from consume' });

            return Promise.reject(e);
          });
      }
    });

    /** start the consumer */
    channelWrapper.waitForConnect()
      .then(() => {
        logger.log('data', { note: `Consumption from ${queueName} started!` });
      })
      .catch(e => logger.log('error', { error: e, note: 'error from consume' }));
  }

  /**
   *  Publisher.
   *
   * @param {object} params - object with queue name and queue options.
   * @param {object} [data] - data to be published.
   * @returns {void | Promise} - Resolves when complete.
   */
  publish({ queue: { name, messagePriority = 0, options = {} } = {} }, data) {
    const queueName = name;
    const queueOptions = options ? { ...options, ...this.defaultQueueFeatures } : this.defaultQueueFeatures;

    if (!queueName) {
      return Promise.reject(new Error('Queue name is missing'));
    }

    // consider message priority if provided
    const msgPriority = messagePriority;
    // persist the message even if the server restarts
    const publishOptions = { persistent: true };

    if (Number(messagePriority) > 0) publishOptions.priority = msgPriority;

    const channelWrapper = this.connection.createChannel({
      json: true,
      setup(channel) {
        // `channel` here is a regular amqplib `ConfirmChannel`.
        return channel.assertQueue(queueName, queueOptions);
      }
    });

    const startPublishing = () => {
      /** returns a <Promise> */
      return channelWrapper
        .sendToQueue(queueName, data, publishOptions)
        .then(() => {
          logger.log('data', { note: `Message sent to queue ${queueName}`, custom: { data } });
          channelWrapper.close();
          return Promise.resolve(data);
        })
        .catch(err => {
          logger.log('error', { note: 'Message is rejected', error: err, custom: { data }});
          channelWrapper.close();
          this.connection.close();
          return Promise.reject(err, data);
        });
    };
  
    /** explicitly return this function*/
    return startPublishing();
  }

  /**
   *  purgeQueue.
   *
   * @param {object} params - object with queue name and queue options.
   * @returns {void | Promise} - Returns resolved promise
   */
  purgeQueue({ queue: { name, options = {}} = {}}) {
    const queueName = name;
    const queueOptions = options ? { ...options, ...this.defaultQueueFeatures } : this.defaultQueueFeatures;

    if (!queueName) {
      return Promise.reject(new Error('Queue name is missing'));
    }

    return new Promise((resolve, reject) => {
      this.connection.createChannel({
        setup(channel) {
          // `channel` here is a regular amqplib `ConfirmChannel`.
          return Promise.all([
            channel.assertQueue(queueName, queueOptions),
            channel.purgeQueue(queueName)
          ])
            .catch(e => {
              return reject('error => ', e);
            });
        }
      });
      
      const result = { name };
      if (Object.keys(options).length) result.options = options;
      
      return resolve({ queue: result });
    });
  }

  /**
   *  ackAll.
   *
   * @returns {void | Promise} - Resolves when complete.
   */
  ackAll() {
    return new Promise(resolve => {
      this.connection.createChannel({
        setup(channel) {
          // `channel` here is a regular amqplib `ConfirmChannel`.
          return channel.ackAll();
        }
      });
  
      return resolve();
    });
  }
}
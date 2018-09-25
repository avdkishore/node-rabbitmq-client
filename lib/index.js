'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.connect = connect;

var _AmqpConnectionManager = require('./AmqpConnectionManager');

var _AmqpConnectionManager2 = _interopRequireDefault(_AmqpConnectionManager);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function connect(urls, options) {
  return new _AmqpConnectionManager2.default(urls, options);
}

const amqp = {
  connect
};

// export default amqp;
const env = process.env.NODE_ENV || 'development';
const currentPath = process.cwd();
const config = require(_path2.default.join(currentPath, 'config', 'env', `${env}`));
console.log(config);

// const QUEUE_NAME = 'amqp-connection-manager-sample'
const { host, port, username, password, vhost, protocol = 'amqp' } = config.rabbitMQ;

// Handle an incomming message.
// const onMessage = function(channelWrapper, data) {
//   const message = JSON.parse(data.content.toString());
//   console.log("receiver: got message", message);
//   channelWrapper.ack(data);
// }

const connectionUrl = `${protocol}://${username}:${password}@${host}:${port}/${vhost}`;

/**
 * options.heartbeatIntervalInSeconds - Interval to send heartbeats to broker. Defaults to 5 seconds.
 * options.reconnectTimeInSeconds - The time to wait before trying to reconnect. If not specified, defaults to heartbeatIntervalInSeconds.
 * options.findServers(callback) is a function which returns one or more servers to connect to. This should return either a single URL or an array of URLs. This is handy when you're using a service discovery mechanism such as Consul or etcd. Instead of taking a callback, this can also return a Promise. Note that if this is supplied, then urls is ignored.
 * options.connectionOptions is passed as options to the amqplib connect method.
 */

// Create a connetion manager
const connection = connect([connectionUrl], { json: true });

console.log(connection);

connection.on('connect', () => {
  console.log('Connected!');
});
connection.on('disconnect', params => {
  console.log('Disconnected.', params.err.stack);
});

/**
 *  Consumer.
 *
 * @param {string} queueName - name of queue.
 * @param {function} [handler] - callback.
 * @returns {void | Promise} - Resolves when complete.
 */
const consume = (queueName, handler) => {
  // Set up a channel listening for messages in the queue.
  const channelWrapper = connection.createChannel({
    setup(channel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      return Promise.all([channel.assertQueue(queueName, { durable: true }), channel.prefetch(1),
      // channel.consume(queueName, handler.bind(null, channelWrapper))
      channel.consume(queueName, data => {
        const message = JSON.parse(data.content.toString());

        handler(message).then(() => channelWrapper.ack(data)).catch(() => {});
      }, { noAck: false })]).catch(e => {
        console.error(e);
      });
    }
  });

  // return channelWrapper;
  return channelWrapper.waitForConnect().then(() => {
    console.log(`Listening for messages on ${queueName}`);
  });
};

/**
 *  Publisher.
 *
 * @param {string} queueName - name of queue.
 * @param {object} [data] - data to be published.
 */
const publish = (queueName, data) => {
  console.log(queueName, data);
  const channelWrapper = connection.createChannel({
    json: true,
    setup(channel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      return channel.assertQueue(queueName, { durable: true });
    }
  });

  // Send messages until someone hits CTRL-C or something goes wrong...
  const startPublishing = () => {
    channelWrapper.sendToQueue(queueName, data, { persistent: true }).then(() => {
      console.log('Message sent');
      // return wait(1000);
      return null;
    }).then(() =>
    // return sendMessage();
    Promise.resolve()).catch(err => {
      console.log('Message was rejected:', err.stack);
      channelWrapper.close();
      connection.close();
    });
  };

  startPublishing();

  // return sendMessage;
};

const purgeQueue = queueName => {
  const channelWrapper = connection.createChannel({
    setup(channel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      return Promise.all([channel.assertQueue(queueName, { durable: true }), channel.purgeQueue(queueName)]);
    }
  });

  return channelWrapper;
};

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

exports.default = amqp;
//# sourceMappingURL=index.js.map
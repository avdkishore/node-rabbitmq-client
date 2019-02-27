const should = require('chai').should();
const RabbitMQClient = require('../../src');

describe('RabbitMQClient', () => {
  const invalidParams = { queue: 'queue-name' };
  const validParams = { queue: { name: 'queue-name' }};
  const priorityQueueParams = {
    queue: {
      name: 'priority-queue',
      options: {
        arguments: {
          /* For more info: https://www.rabbitmq.com/priority.html */
          'x-max-priority': 9
        }
      },
      messagePriority: 8
    }
  };
  const data = { message: 'message' };

  /** resolve should be invoked in the context of Promise object */
  const handler = Promise.resolve.bind(Promise);

  it('should exist', done => {
    RabbitMQClient.should.be.an('object').with.keys(['connection', 'publish', 'consume', 'purgeQueue', 'ackAll']);
    done();
  });

  it('should return rejected promise when queue is not an object for `publish', () => {
    RabbitMQClient.publish(invalidParams, data)
      .then(() => {
        throw new Error('should throw error');
      })
      .catch(e => {
        should.exist(e);
      });
  });

  it('should return rejected promise when queue is not an object for `consume`', () => {
    RabbitMQClient.consume(invalidParams, handler)
      .then(() => {
        throw new Error('should throw error');
      })
      .catch(e => {
        should.exist(e);
      });
  });

  it('should return resolved promise when message is published', () => {
    RabbitMQClient.publish(validParams, data)
      .then(m => {
        m.should.be.an('object');
        m.should.deep.equal(data);
      })
      .catch(() => {
        throw new Error('should not return a rejected promise');
      });
  });

  it('should return resolved promise when a message with priority is published', () => {
    RabbitMQClient.publish(priorityQueueParams, data)
      .then(m => {
        m.should.be.an('object');
        m.should.deep.equal(data);
      })
      .catch(() => {
        throw new Error('should not return a rejected promise');
      });
  });

  it('should invoke promise handler with the message consumed', () => {
    const callbackHandler = (message, options) => {
      if (!message || !options) throw new Error('handler should be invoked with message and options');

      options.should.be.an('object');
      message.should.be.an('object');
      message.should.deep.equal(data);
      return Promise.resolve();
    };

    RabbitMQClient.consume(validParams, callbackHandler);
  });

  it('should return channel object for purgeQueue', () => {
    RabbitMQClient.purgeQueue(validParams)
      .then(message => {
        if (!message) throw new Error('should resolve with a message');

        message.should.be.an('object');
        message.should.deep.equal(validParams);
      })
      .catch(() => { throw new Error('should not reject the promise'); });
  });
  
  it('should return resolved promise for purgeQueue', () => {
    RabbitMQClient.ackAll()
      .then(data => {
        if (data) throw new Error('should resolve with empty promise');
      })
      .catch(() => { throw new Error('should not reject the promise'); });
  });
});
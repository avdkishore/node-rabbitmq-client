import RabbitMQClient from '../../src';
import { rabbitMQ } from '../../config';
import chai from 'chai';

const should = chai.should();

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

  const client = new RabbitMQClient(rabbitMQ);

  it('should exist', done => {
    RabbitMQClient.should.exist;
    client.should.be.instanceOf(RabbitMQClient);
    done();
  });

  it('should return rejected promise when queue is not an object for `publish', () => {
    client.publish(invalidParams, data)
      .then(() => {
        throw new Error('should throw error');
      })
      .catch(e => {
        should.exist(e);
      });
  });

  it('should return rejected promise when queue is not an object for `consume`', () => {
    client.consume(invalidParams, handler)
      .then(() => {
        throw new Error('should throw error');
      })
      .catch(e => {
        should.exist(e);
      });
  });

  it('should return resolved promise when message is published', () => {
    client.publish(validParams, data)
      .then(m => {
        m.should.be.an('object');
        m.should.deep.equal(data);
      })
      .catch(() => {
        throw new Error('should not return a rejected promise');
      });
  });

  it('should return resolved promise when a message with priority is published', () => {
    client.publish(priorityQueueParams, data)
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

    client.consume(validParams, callbackHandler);
  });

  it('should return channel object for purgeQueue', () => {
    client.purgeQueue(validParams)
      .then(message => {
        if (!message) throw new Error('should resolve with a message');

        message.should.be.an('object');
        message.should.deep.equal(validParams);
      })
      .catch((e) => { throw new Error(e); });
  });
  
  it('should return resolved promise for ackAll', () => {
    client.ackAll()
      .then(data => {
        if (data) throw new Error('should resolve with empty promise');
      })
      .catch(() => { throw new Error('should not reject the promise'); });
  });

  after(() => {
    setTimeout(client.connection.close, 1000);
  });
});
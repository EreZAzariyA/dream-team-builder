// Mock Pusher for testing
const { EventEmitter } = require('events')

class MockPusherServer extends EventEmitter {
  constructor(config) {
    super()
    this.config = config
    this.channels = new Map()
    this.events = []
  }
  
  async trigger(channel, event, data) {
    this.events.push({ channel, event, data, timestamp: Date.now() })
    this.emit('trigger', { channel, event, data })
    return { status: 200 }
  }
  
  async triggerBatch(batch) {
    for (const item of batch) {
      await this.trigger(item.channel, item.name, item.data)
    }
    return { status: 200 }
  }
  
  // Test utilities
  getEvents() {
    return this.events
  }
  
  getEventsForChannel(channel) {
    return this.events.filter(event => event.channel === channel)
  }
  
  clearEvents() {
    this.events = []
  }
  
  getLastEvent() {
    return this.events[this.events.length - 1]
  }
}

class MockPusherClient extends EventEmitter {
  constructor(key, options) {
    super()
    this.key = key
    this.options = options
    this.connection = {
      state: 'disconnected',
      socket_id: 'mock-socket-id',
    }
    this.channels = new Map()
  }
  
  connect() {
    this.connection.state = 'connecting'
    setTimeout(() => {
      this.connection.state = 'connected'
      this.emit('connected')
    }, 100)
  }
  
  disconnect() {
    this.connection.state = 'disconnected'
    this.emit('disconnected')
  }
  
  subscribe(channelName) {
    const channel = new MockChannel(channelName)
    this.channels.set(channelName, channel)
    this.emit('subscription_succeeded', channel)
    return channel
  }
  
  unsubscribe(channelName) {
    if (this.channels.has(channelName)) {
      const channel = this.channels.get(channelName)
      channel.emit('pusher:subscription_cancelled')
      this.channels.delete(channelName)
    }
  }
  
  bind(event, callback) {
    this.on(event, callback)
  }
  
  unbind(event, callback) {
    this.off(event, callback)
  }
  
  // Test utilities
  simulateEvent(channel, event, data) {
    if (this.channels.has(channel)) {
      this.channels.get(channel).emit(event, data)
    }
  }
  
  getSubscribedChannels() {
    return Array.from(this.channels.keys())
  }
}

class MockChannel extends EventEmitter {
  constructor(name) {
    super()
    this.name = name
    this.subscribed = true
  }
  
  bind(event, callback) {
    this.on(event, callback)
  }
  
  unbind(event, callback) {
    this.off(event, callback)
  }
  
  trigger(event, data) {
    this.emit(event, data)
    return this
  }
}

// Mock the pusher module
const mockPusherServer = new MockPusherServer()
const mockPusherClient = new MockPusherClient()

// Export mocks
module.exports = {
  // Server-side mock
  default: function(config) {
    return new MockPusherServer(config)
  },
  
  // Client-side mock
  Pusher: function(key, options) {
    return new MockPusherClient(key, options)
  },
  
  // Test utilities
  MockPusherServer,
  MockPusherClient,
  MockChannel,
  
  // Singleton instances for testing
  mockPusherServer,
  mockPusherClient,
  
  // Reset function for tests
  resetMocks: () => {
    mockPusherServer.clearEvents()
    mockPusherClient.channels.clear()
    mockPusherClient.connection.state = 'disconnected'
  }
}

// Mock pusher-js
jest.mock('pusher-js', () => {
  return module.exports.Pusher
})

// Mock pusher (server)
jest.mock('pusher', () => {
  return module.exports.default
})
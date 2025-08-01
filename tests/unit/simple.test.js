/**
 * Simple Unit Test to verify Jest setup
 */

describe('Jest Setup Verification', () => {
  test('should run basic test', () => {
    expect(1 + 1).toBe(2)
  })

  test('should handle async operations', async () => {
    const result = await Promise.resolve('test')
    expect(result).toBe('test')
  })

  test('should have access to global test utils', () => {
    expect(global.testUtils).toBeDefined()
    expect(typeof global.testUtils.generateTestId).toBe('function')
  })

  test('should mock console properly', () => {
    console.warn('test warning')
    expect(console.warn).toHaveBeenCalledWith('test warning')
  })

  test('should handle fake timers', () => {
    const callback = jest.fn()
    setTimeout(callback, 1000)
    
    expect(callback).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalled()
  })
})
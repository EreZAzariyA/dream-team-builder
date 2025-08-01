/**
 * Basic Test - No setup dependencies
 */

describe('Basic Jest Functionality', () => {
  test('should run basic test', () => {
    expect(1 + 1).toBe(2)
  })

  test('should handle strings', () => {
    expect('hello').toBe('hello')
    expect('hello world').toContain('world')
  })

  test('should handle objects', () => {
    const obj = { name: 'test', value: 42 }
    expect(obj).toHaveProperty('name', 'test')
    expect(obj).toMatchObject({ value: 42 })
  })

  test('should handle arrays', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(arr).toHaveLength(5)
    expect(arr).toContain(3)
  })

  test('should handle async/await', async () => {
    const asyncFunction = async () => {
      return new Promise(resolve => {
        setTimeout(() => resolve('success'), 10)
      })
    }
    
    const result = await asyncFunction()
    expect(result).toBe('success')
  })

  test('should handle mock functions', () => {
    const mockFn = jest.fn()
    mockFn('test-arg')
    
    expect(mockFn).toHaveBeenCalled()
    expect(mockFn).toHaveBeenCalledWith('test-arg')
  })
})
/**
 * Consolidated Jest Setup Verification Tests
 * Verifies basic Jest functionality and global test utilities.
 */

describe('Jest Setup Verification', () => {
  // Combined tests from basic.test.js
  test('should run basic arithmetic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle strings', () => {
    expect('hello').toBe('hello');
    expect('hello world').toContain('world');
  });

  test('should handle objects', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj).toHaveProperty('name', 'test');
    expect(obj).toMatchObject({ value: 42 });
  });

  test('should handle arrays', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toHaveLength(5);
    expect(arr).toContain(3);
  });

  test('should handle async/await operations', async () => {
    const asyncFunction = async () => {
      return Promise.resolve('success');
    };
    const result = await asyncFunction();
    expect(result).toBe('success');
  });

  test('should handle mock functions', () => {
    const mockFn = jest.fn();
    mockFn('test-arg');
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith('test-arg');
  });

  // Combined tests from simple.test.js
  test('should have access to global test utils', () => {
    expect(global.testUtils).toBeDefined();
    expect(typeof global.testUtils.generateTestId).toBe('function');
  });

  test('should mock console properly', () => {
    const originalWarn = console.warn;
    console.warn = jest.fn(); // Temporarily mock console.warn

    console.warn('test warning');
    expect(console.warn).toHaveBeenCalledWith('test warning');

    console.warn = originalWarn; // Restore original console.warn
  });

  test('should handle fake timers', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    setTimeout(callback, 1000);
    
    expect(callback).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalled();
    jest.useRealTimers(); // Restore real timers
  });
});

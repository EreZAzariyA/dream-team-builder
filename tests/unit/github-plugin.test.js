import { GitHubPlugin } from '../../lib/integrations/github-plugin.js';
import { jest } from '@jest/globals';

// Mock fetch API
global.fetch = jest.fn();

describe('GitHubPlugin', () => {
  let plugin;
  const mockConfig = { token: 'test-token' };
  const mockUserContext = { githubAccessToken: 'test-user-token' };

  beforeEach(() => {
    plugin = new GitHubPlugin();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    test('should initialize with user context token', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      await plugin.initialize(mockConfig, mockUserContext);
      expect(plugin.headers.Authorization).toBe('Bearer test-user-token');
    });

    test('should initialize with config token if no user context token', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      await plugin.initialize(mockConfig);
      expect(plugin.headers.Authorization).toBe('Bearer test-token');
    });

    test('should throw error if no token is provided', async () => {
      await expect(plugin.initialize({})).rejects.toThrow('GitHub authentication required');
    });
  });

  describe('getDirectory', () => {
    const mockDirectoryContents = [
      { name: 'file1.txt', type: 'file', path: 'path/to/file1.txt' },
      { name: 'subdir', type: 'dir', path: 'path/to/subdir' },
    ];

    beforeEach(async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      await plugin.initialize(mockConfig, mockUserContext);
    });

    test('should return directory contents for a valid path', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDirectoryContents) });

      const data = { owner: 'test-owner', repo: 'test-repo', path: 'test-path' };
      const contents = await plugin.getDirectory(data);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/test-path?ref=main',
        expect.any(Object)
      );
      expect(contents).toEqual(mockDirectoryContents);
    });

    test('should throw an error if API call fails', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Not Found' }) });

      const data = { owner: 'test-owner', repo: 'test-repo', path: 'non-existent-path' };
      await expect(plugin.getDirectory(data)).rejects.toThrow('Failed to get directory contents: Not Found');
    });

    test('should use specified branch if provided', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDirectoryContents) });

      const data = { owner: 'test-owner', repo: 'test-repo', path: 'test-path', branch: 'dev' };
      await plugin.getDirectory(data);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/test-path?ref=dev',
        expect.any(Object)
      );
    });
  });

  describe('getFile', () => {
    const mockFileContent = 'Hello, this is a test file.';
    const mockBase64Content = Buffer.from(mockFileContent).toString('base64');
    const mockFileResponse = {
      name: 'test.txt',
      path: 'path/to/test.txt',
      sha: 'mock-sha',
      size: mockFileContent.length,
      url: 'mock-url',
      html_url: 'mock-html-url',
      git_url: 'mock-git-url',
      download_url: 'mock-download-url',
      type: 'file',
      content: mockBase64Content,
      encoding: 'base64',
    };

    beforeEach(async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      await plugin.initialize(mockConfig, mockUserContext);
    });

    test('should return file contents for a valid path', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFileResponse) });

      const data = { owner: 'test-owner', repo: 'test-repo', path: 'test-path/test.txt' };
      const file = await plugin.getFile(data);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/test-path/test.txt?ref=main',
        expect.any(Object)
      );
      expect(file.decodedContent).toBe(mockFileContent);
      expect(file.name).toBe('test.txt');
    });

    test('should throw an error if API call fails', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Not Found' }) });

      const data = { owner: 'test-owner', repo: 'test-repo', path: 'non-existent-file.txt' };
      await expect(plugin.getFile(data)).rejects.toThrow('Failed to get file: Not Found');
    });

    test('should use specified branch if provided', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFileResponse) });

      const data = { owner: 'test-owner', repo: 'test-repo', path: 'test-path/test.txt', branch: 'dev' };
      await plugin.getFile(data);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/test-path/test.txt?ref=dev',
        expect.any(Object)
      );
    });

    test('should handle non-base64 encoded content', async () => {
      const mockNonBase64Response = { ...mockFileResponse, encoding: 'none', content: mockFileContent };
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockNonBase64Response) });

      const data = { owner: 'test-owner', repo: 'test-repo', path: 'test-path/non-base64.txt' };
      const file = await plugin.getFile(data);

      expect(file.decodedContent).toBeUndefined(); // Should not decode if not base64
      expect(file.content).toBe(mockFileContent);
    });
  });

  describe('uploadFile', () => {
    const mockFileContent = 'New file content.';
    const mockBase64Content = Buffer.from(mockFileContent).toString('base64');
    const mockUploadResponse = {
      content: {
        name: 'new-file.txt',
        path: 'path/to/new-file.txt',
        sha: 'new-mock-sha',
        html_url: 'mock-html-url',
      },
      commit: {
        sha: 'mock-commit-sha',
        html_url: 'mock-commit-html-url',
      },
    };

    beforeEach(async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      await plugin.initialize(mockConfig, mockUserContext);
    });

    test('should upload a new file', async () => {
      // Mock getFile to throw an error (file not found)
      jest.spyOn(plugin, 'getFile').mockRejectedValueOnce(new Error('File not found'));
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockUploadResponse) });

      const data = {
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'test-path/new-file.txt',
        content: mockFileContent,
        message: 'Add new file',
      };
      const result = await plugin.uploadFile(data);

      expect(plugin.getFile).toHaveBeenCalledWith({
        owner: data.owner,
        repo: data.repo,
        path: data.path,
        branch: 'main',
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/test-path/new-file.txt',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            message: data.message,
            content: mockBase64Content,
            branch: 'main',
          }),
        })
      );
      expect(result).toEqual(mockUploadResponse);
    });

    test('should update an existing file', async () => {
      // Mock getFile to return an existing file SHA
      jest.spyOn(plugin, 'getFile').mockResolvedValueOnce({ sha: 'existing-sha' });
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockUploadResponse) });

      const data = {
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'test-path/existing-file.txt',
        content: mockFileContent,
        message: 'Update existing file',
      };
      const result = await plugin.uploadFile(data);

      expect(plugin.getFile).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/test-path/existing-file.txt',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            message: data.message,
            content: mockBase64Content,
            branch: 'main',
            sha: 'existing-sha', // SHA should be included for update
          }),
        })
      );
      expect(result).toEqual(mockUploadResponse);
    });

    test('should throw an error if API call fails', async () => {
      jest.spyOn(plugin, 'getFile').mockRejectedValueOnce(new Error('File not found'));
      fetch.mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({ message: 'Bad Request' }) });

      const data = {
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'test-path/error-file.txt',
        content: mockFileContent,
        message: 'Error upload',
      };
      await expect(plugin.uploadFile(data)).rejects.toThrow('Failed to upload file: Bad Request');
    });

    test('should use specified branch if provided', async () => {
      jest.spyOn(plugin, 'getFile').mockRejectedValueOnce(new Error('File not found'));
      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockUploadResponse) });

      const data = {
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'test-path/branch-file.txt',
        content: mockFileContent,
        message: 'Upload to branch',
        branch: 'feature-branch',
      };
      await plugin.uploadFile(data);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/test-path/branch-file.txt',
        expect.objectContaining({
          body: JSON.stringify({
            message: data.message,
            content: mockBase64Content,
            branch: 'feature-branch',
          }),
        })
      );
    });
  });
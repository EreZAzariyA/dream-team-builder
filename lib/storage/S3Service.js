import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

/**
 * S3 Service for BMAD file storage
 * Handles agent-generated files in cloud storage for Vercel compatibility
 */
class S3Service {
  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    this.bucketName = process.env.S3_BUCKET_NAME || 'bmad-generated-files';
    
    // Validate configuration
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn('⚠️ AWS credentials not configured. S3 operations will fail.');
    }
  }

  /**
   * Generate S3 key based on BMAD context
   * @param {string} userId - User ID
   * @param {string} context - 'agents-chat' or 'agent-teams'
   * @param {string} agentId - Agent ID (pm, architect, dev, etc.)
   * @param {string} filename - File name with extension
   * @param {string} team - Team name (for agent-teams only)
   * @param {string} workflowId - Workflow ID (for agent-teams only)
   * @returns {string} S3 key
   */
  generateKey(userId, context, agentId, filename, team = null, workflowId = null) {
    if (context === 'agents-chat') {
      return `${userId}/agents-chat/${agentId}/${filename}`;
    } else if (context === 'agent-teams') {
      if (!team || !workflowId) {
        throw new Error('Team and workflowId are required for agent-teams context');
      }
      return `${userId}/agent-teams/${team}/${workflowId}/${agentId}/${filename}`;
    } else {
      throw new Error(`Invalid context: ${context}. Must be 'agents-chat' or 'agent-teams'`);
    }
  }

  /**
   * Write file to S3
   * @param {string} key - S3 key
   * @param {string} content - File content
   * @param {string} contentType - MIME type
   * @returns {Promise<object>} S3 response
   */
  async writeFile(key, content, contentType = 'text/markdown') {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
        Metadata: {
          uploadedAt: new Date().toISOString(),
          source: 'bmad-agent'
        }
      });

      const response = await this.client.send(command);
      
      console.log(`✅ File uploaded to S3: ${key}`);
      return {
        success: true,
        key,
        url: `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`,
        etag: response.ETag
      };
    } catch (error) {
      console.error(`❌ Failed to upload file to S3: ${key}`, error);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Read file from S3
   * @param {string} key - S3 key
   * @returns {Promise<string>} File content
   */
  async readFile(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      const content = await response.Body.transformToString();
      
      console.log(`✅ File read from S3: ${key}`);
      return content;
    } catch (error) {
      console.error(`❌ Failed to read file from S3: ${key}`, error);
      throw new Error(`S3 read failed: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 key
   * @returns {Promise<object>} S3 response
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      
      console.log(`✅ File deleted from S3: ${key}`);
      return { success: true, key };
    } catch (error) {
      console.error(`❌ Failed to delete file from S3: ${key}`, error);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  /**
   * List files in S3 folder
   * @param {string} prefix - S3 key prefix (folder path)
   * @returns {Promise<Array>} Array of file objects
   */
  async listFiles(prefix) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.client.send(command);
      
      const files = (response.Contents || []).map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        url: `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${obj.Key}`
      }));
      
      console.log(`✅ Listed ${files.length} files from S3: ${prefix}`);
      return files;
    } catch (error) {
      console.error(`❌ Failed to list files from S3: ${prefix}`, error);
      throw new Error(`S3 list failed: ${error.message}`);
    }
  }

  /**
   * Check if bucket exists, create if needed
   * @returns {Promise<boolean>} True if bucket exists or was created
   */
  async ensureBucketExists() {
    try {
      // Try to check if bucket exists
      const headCommand = new HeadBucketCommand({
        Bucket: this.bucketName,
      });

      await this.client.send(headCommand);
      console.log(`✅ S3 bucket ${this.bucketName} exists`);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.message.includes('does not exist')) {
        console.log(`📦 Creating S3 bucket: ${this.bucketName}`);
        
        try {
          // Create the bucket
          const createCommand = new CreateBucketCommand({
            Bucket: this.bucketName,
            CreateBucketConfiguration: {
              LocationConstraint: process.env.AWS_REGION === 'us-east-1' ? undefined : process.env.AWS_REGION || 'us-east-1'
            }
          });

          await this.client.send(createCommand);
          console.log(`✅ S3 bucket ${this.bucketName} created successfully`);
          return true;
        } catch (createError) {
          console.error(`❌ Failed to create S3 bucket: ${createError.message}`);
          return false;
        }
      } else {
        console.error(`❌ Error checking S3 bucket: ${error.message}`);
        return false;
      }
    }
  }

  /**
   * Check if S3 service is configured and available
   * @returns {Promise<boolean>} True if S3 is available
   */
  async isAvailable() {
    try {
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return false;
      }

      // Ensure bucket exists first
      const bucketExists = await this.ensureBucketExists();
      if (!bucketExists) {
        return false;
      }

      // Try to list bucket to test connectivity
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('❌ S3 service not available:', error.message);
      return false;
    }
  }

  /**
   * Generate agent file path helpers
   */
  static paths = {
    agentChat: (userId, agentId, filename) => ({
      context: 'agents-chat',
      userId,
      agentId,
      filename,
      key: `${userId}/agents-chat/${agentId}/${filename}`
    }),
    
    agentTeam: (userId, team, workflowId, agentId, filename) => ({
      context: 'agent-teams',
      userId,
      team,
      workflowId,
      agentId,
      filename,
      key: `${userId}/agent-teams/${team}/${workflowId}/${agentId}/${filename}`
    })
  };
}

// Create singleton instance
const s3Service = new S3Service();

export { S3Service, s3Service };
export default s3Service;
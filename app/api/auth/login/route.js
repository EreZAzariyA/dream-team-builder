import { User } from '../../../../lib/database/models/index.js';
import { 
  withDatabase, 
  withMethods, 
  withValidation, 
  withRateLimit,
  withErrorHandling,
  compose,
  apiResponse,
  tokenUtils 
} from '../../../../lib/api/middleware.js';

// Validation schema for user login
const loginSchema = {
  email: { required: true, type: 'email' },
  password: { required: true, minLength: 1 },
};

const handler = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json(
        apiResponse.error('Invalid credentials', 'INVALID_CREDENTIALS')
      );
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json(
        apiResponse.error('Account is deactivated', 'ACCOUNT_DEACTIVATED')
      );
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json(
        apiResponse.error('Invalid credentials', 'INVALID_CREDENTIALS')
      );
    }
    
    // Generate JWT token
    const token = tokenUtils.generate({
      userId: user._id,
      email: user.email,
      role: user.profile.role,
    });
    
    // Update login tracking
    await user.updateLastLogin();
    
    return res.status(200).json(
      apiResponse.success({
        user: user.toPublicJSON(),
        token,
        expiresIn: '24h',
      }, 'Login successful')
    );
    
  } catch (error) {
    console.error('Login error:', error);
    throw error; // Will be caught by error handling middleware
  }
};

// Apply middleware using compose
export const POST = compose(
  withMethods(['POST']),
  withDatabase,
  withRateLimit(15 * 60 * 1000, 10), // 10 login attempts per 15 minutes
  withValidation(loginSchema),
  withErrorHandling
)(handler);
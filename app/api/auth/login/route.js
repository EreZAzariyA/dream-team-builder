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
import { NextResponse } from 'next/server';
import { logUserActivity } from '../../../../lib/utils/activityLogger.js';

// Validation schema for user login
const loginSchema = {
  email: { required: true, type: 'email' },
  password: { required: true, minLength: 1 },
};

const handler = async (req) => {
  const { email, password } = req.validatedBody;
  
  try {
    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return NextResponse.json(
        apiResponse.error('Invalid credentials', 'INVALID_CREDENTIALS'),
        { status: 401 }
      );
    }
    
    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        apiResponse.error('Account is deactivated', 'ACCOUNT_DEACTIVATED'),
        { status: 401 }
      );
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json(
        apiResponse.error('Invalid credentials', 'INVALID_CREDENTIALS'),
        { status: 401 }
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
    
    // Log user login activity
    await logUserActivity(user._id, 'login', { method: 'credentials' }, req);
    
    return NextResponse.json(
      apiResponse.success({
        user: user.toPublicJSON(),
        token,
        expiresIn: '24h',
      }, 'Login successful'),
      { status: 200 }
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
  withRateLimit('auth'), // 5 login attempts per 15 minutes in production
  withValidation(loginSchema),
  withErrorHandling
)(handler);
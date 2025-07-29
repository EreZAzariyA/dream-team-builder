import { User } from '../../../../lib/database/models/index.js';
import { signIn } from 'next-auth/react';
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

// Validation schema for user registration
const registrationSchema = {
  email: { required: true, type: 'email' },
  password: { required: true, minLength: 6, maxLength: 100 },
  name: { required: true, minLength: 2, maxLength: 100 },
  acceptTerms: { required: true },
};

const handler = async (req, res) => {
  const { email, password, name, acceptTerms } = req.body;
  
  try {
    // Check terms acceptance
    if (!acceptTerms) {
      return res.status(400).json(
        apiResponse.error('Terms and conditions must be accepted', 'TERMS_REQUIRED')
      );
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json(
        apiResponse.error('User already exists', 'EMAIL_EXISTS')
      );
    }
    
    // Create new user
    const userData = {
      email: email.toLowerCase().trim(),
      passwordHash: password, // Will be hashed by the model middleware
      profile: {
        name: name.trim(),
      },
      isEmailVerified: false, // In production, implement email verification
    };
    
    const user = await User.createUser(userData);
    
    // For API clients, return token
    if (req.headers['content-type'] === 'application/json') {
      const token = tokenUtils.generate({
        userId: user._id,
        email: user.email,
        role: user.profile.role,
      });
      
      return res.status(201).json(
        apiResponse.success({
          user: user.toPublicJSON(),
          token,
          expiresIn: '24h',
        }, 'User registered successfully')
      );
    }
    
    // For web clients, return success without auto-login
    return res.status(201).json(
      apiResponse.success({
        user: user.toPublicJSON(),
        message: 'Registration successful. Please sign in.',
      }, 'User registered successfully')
    );
    
  } catch (error) {
    console.error('Registration error:', error);
    throw error; // Will be caught by error handling middleware
  }
};

// Apply middleware using compose
export const POST = compose(
  withMethods(['POST']),
  withDatabase,
  withRateLimit(15 * 60 * 1000, 5), // 5 registrations per 15 minutes
  withValidation(registrationSchema),
  withErrorHandling
)(handler);
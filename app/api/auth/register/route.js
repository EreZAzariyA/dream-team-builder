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
import { NextResponse } from 'next/server.js';
import { logUserActivity } from '@/lib/utils/activityLogger.js';

// Validation schema for user registration
const registrationSchema = {
  email: { required: true, type: 'email' },
  password: { required: true, minLength: 6, maxLength: 100 },
  name: { required: true, minLength: 2, maxLength: 100 },
  acceptTerms: { required: true },
};

const handler = async (req) => {
  const { email, password, name, acceptTerms } = req.validatedBody;
  
  try {
    // Check terms acceptance
    if (!acceptTerms) {
      return NextResponse.json(
        apiResponse.error('Terms and conditions must be accepted', 'TERMS_REQUIRED'),
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        apiResponse.error('User already exists', 'EMAIL_EXISTS'),
        { status: 409 }
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

    // Log user registration activity
    await logUserActivity(user._id, 'login', { method: 'credentials' }, req);
    
    // For API clients, return token
    if (req.headers.get('content-type') === 'application/json') {
      const token = tokenUtils.generate({
        userId: user._id,
        email: user.email,
        role: user.profile.role,
      });
      
      return NextResponse.json(
        apiResponse.success({
          user: user.toPublicJSON(),
          token,
          expiresIn: '24h',
        }, 'User registered successfully'),
        { status: 201 }
      );
    }
    
    // For web clients, return success without auto-login
    return NextResponse.json(
      apiResponse.success({
        user: user.toPublicJSON(),
        message: 'Registration successful. Please sign in.',
      }, 'User registered successfully'),
      { status: 201 }
    );
    
  } catch (error) {
    logger.error('Registration error:', error);
    throw error; // Will be caught by error handling middleware
  }
};

// Apply middleware using compose
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Creates a new user account with email, password, and name.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - acceptTerms
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address.
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: User's password (min 6 characters).
 *               name:
 *                 type: string
 *                 description: User's full name.
 *               acceptTerms:
 *                 type: boolean
 *                 description: User's acceptance of terms and conditions.
 *     responses:
 *       201:
 *         description: User registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       description: Newly created user object (public fields).
 *                     token:
 *                       type: string
 *                       description: JWT token for API clients (if content-type is application/json).
 *                     expiresIn:
 *                       type: string
 *                       example: 24h
 *       400:
 *         description: Bad request (e.g., validation errors, terms not accepted).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Validation failed
 *                 message:
 *                   type: string
 *                   example: Request validation errors
 *       409:
 *         description: Conflict (e.g., email already exists).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: User already exists
 *                 message:
 *                   type: string
 *                   example: Email already exists
 *       500:
 *         description: Internal server error.
 */
export const POST = compose(
  withMethods(['POST']),
  withDatabase,
  withRateLimit('auth'), // 5 auth attempts per 15 minutes in production
  withValidation(registrationSchema),
  withErrorHandling
)(handler);
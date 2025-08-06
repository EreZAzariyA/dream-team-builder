import { 
  withDatabase, 
  withMethods, 
  withAuth,
  withErrorHandling,
  compose,
  apiResponse 
} from '../../../../lib/api/middleware.js';

const handler = async (req, res) => {
  try {
    // User is attached to req by withAuth middleware
    const user = req.user;
    
    return res.status(200).json(
      apiResponse.success({
        user: user.toPublicJSON(),
      }, 'User profile retrieved successfully')
    );
    
  } catch (error) {
    logger.error('Get profile error:', error);
    throw error;
  }
};

// Apply middleware using compose
export const GET = compose(
  withMethods(['GET']),
  withDatabase,
  withAuth,
  withErrorHandling
)(handler);
import { User } from '../../../../lib/database/models/index.js';
import { 
  withDatabase, 
  withMethods, 
  withAuth,
  withValidation,
  withErrorHandling,
  compose,
  apiResponse 
} from '../../../../lib/api/middleware.js';

// Validation schema for user updates
const updateUserSchema = {
  name: { minLength: 2, maxLength: 100 },
  bio: { maxLength: 500 },
  avatar: { type: 'string' },
};

const getHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can only access their own profile or admins can access any profile
    if (req.user._id.toString() !== id && req.user.profile.role !== 'admin') {
      return res.status(403).json(
        apiResponse.error('Access denied', 'FORBIDDEN')
      );
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(
        apiResponse.error('User not found', 'USER_NOT_FOUND')
      );
    }
    
    return res.status(200).json(
      apiResponse.success({
        user: user.toPublicJSON(),
      }, 'User retrieved successfully')
    );
    
  } catch (error) {
    logger.error('Get user error:', error);
    throw error;
  }
};

const updateHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Users can only update their own profile
    if (req.user._id.toString() !== id) {
      return res.status(403).json(
        apiResponse.error('Access denied', 'FORBIDDEN')
      );
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(
        apiResponse.error('User not found', 'USER_NOT_FOUND')
      );
    }
    
    // Update allowed fields
    if (updates.name !== undefined) {
      user.profile.name = updates.name;
    }
    
    if (updates.bio !== undefined) {
      user.profile.bio = updates.bio;
    }
    
    if (updates.avatar !== undefined) {
      user.profile.avatar = updates.avatar;
    }
    
    // Update preferences if provided
    if (updates.preferences) {
      if (updates.preferences.theme) {
        user.preferences.theme = updates.preferences.theme;
      }
      
      if (updates.preferences.notifications) {
        user.preferences.notifications = {
          ...user.preferences.notifications,
          ...updates.preferences.notifications,
        };
      }
      
      if (updates.preferences.ui) {
        user.preferences.ui = {
          ...user.preferences.ui,
          ...updates.preferences.ui,
        };
      }
    }
    
    await user.save();
    
    return res.status(200).json(
      apiResponse.success({
        user: user.toPublicJSON(),
      }, 'User updated successfully')
    );
    
  } catch (error) {
    logger.error('Update user error:', error);
    throw error;
  }
};

const deleteHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can only delete their own account or admins can delete any account
    if (req.user._id.toString() !== id && req.user.profile.role !== 'admin') {
      return res.status(403).json(
        apiResponse.error('Access denied', 'FORBIDDEN')
      );
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(
        apiResponse.error('User not found', 'USER_NOT_FOUND')
      );
    }
    
    // Soft delete - just deactivate the account
    user.isActive = false;
    await user.save();
    
    return res.status(200).json(
      apiResponse.success({
        userId: id,
      }, 'User account deactivated successfully')
    );
    
  } catch (error) {
    logger.error('Delete user error:', error);
    throw error;
  }
};

// Apply middleware for different HTTP methods
export const GET = compose(
  withMethods(['GET']),
  withDatabase,
  withAuth,
  withErrorHandling
)(getHandler);

export const PUT = compose(
  withMethods(['PUT']),
  withDatabase,
  withAuth,
  withValidation(updateUserSchema),
  withErrorHandling
)(updateHandler);

export const DELETE = compose(
  withMethods(['DELETE']),
  withDatabase,
  withAuth,
  withErrorHandling
)(deleteHandler);
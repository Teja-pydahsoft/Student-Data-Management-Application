const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  console.log('🔐 Auth middleware triggered for:', req.method, req.path);
  console.log('🔐 Request headers:', {
    authorization: req.headers.authorization ? 'Bearer [token]' : 'No token',
    'content-type': req.headers['content-type'],
    origin: req.headers.origin
  });

  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    console.log('🔐 Auth header present:', !!authHeader);

    if (!authHeader) {
      console.log('❌ No authorization header provided');
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.'
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('🔐 Token extracted:', !!token, token ? `${token.substring(0, 20)}...` : 'No token');

    if (!token) {
      console.log('❌ No token in authorization header');
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.'
      });
    }

    // Verify token
    console.log('🔐 Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified successfully for admin:', decoded.username, decoded.id);
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    console.error('❌ Error stack:', error.stack);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

module.exports = authMiddleware;

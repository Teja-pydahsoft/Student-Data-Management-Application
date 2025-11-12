const requireAdmin = (req, res, next) => {
  const user = req.user || req.admin;

  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Administrator access required'
    });
  }

  next();
};

module.exports = {
  requireAdmin
};



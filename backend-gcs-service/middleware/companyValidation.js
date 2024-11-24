const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const getBucketName = (company) => {
  const sanitizedName = company.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${process.env.BUCKET_PREFIX}-${sanitizedName}`;
};



exports.validateCompany = async (req, res, next) => {
  console.log('Validating company access:', {
    path: req.path,
    params: req.params,
    headers: {
      hasAuth: !!req.headers.authorization,
      company: req.headers['x-company-name']
    }
  });

  try {
    // Validate auth header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Auth header missing or invalid:', { authHeader });
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Get and validate company names
    const headerCompany = req.headers['x-company-name']?.toLowerCase();
    const paramCompany = req.params.companyName?.toLowerCase(); // Changed from companyName


    console.log('Company validation:', {
      headerCompany,
      paramCompany,
      params: req.params,
      path: req.path
    });

    
    if (!headerCompany || !paramCompany) {
      return res.status(400).json({ 
        error: 'Company name is required in both header and URL' 
      });
    }
    
    if (headerCompany !== paramCompany) {
      return res.status(403).json({ 
        error: 'Company name mismatch between header and URL' 
      });
    }

    // Verify token and get user info
    const token = authHeader.split('Bearer ')[1];
    console.log('About to verify token:', { tokenLength: token?.length });
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log('Token verified successfully:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        tokenIssuer: decodedToken.iss,
        tokenAudience: decodedToken.aud,
        tokenExpiration: new Date(decodedToken.exp * 1000).toISOString()
      });
      
      // Get company from email domain
      const email = decodedToken.email;
      if (!email) {
        console.log('No email in decoded token');
        return res.status(401).json({ error: 'No email found in token' });
      }
      
      const domain = email.split('@')[1];
      const userCompany = domain.split('.')[0].toLowerCase();

      console.log('Derived company details:', {
        email,
        domain,
        userCompany,
        headerCompany
      });

      // Verify company match
      if (userCompany !== headerCompany) {
        console.log('Company mismatch:', {
          userEmail: email,
          derivedCompany: userCompany,
          requestedCompany: headerCompany
        });
        return res.status(403).json({ 
          error: 'User does not belong to this company',
          userCompany,
          requestedCompany: headerCompany
        });
      }

      // Verify/create bucket
      const bucketName = getBucketName(headerCompany);
      console.log('Checking bucket:', { bucketName });
      
      const bucket = storage.bucket(bucketName);
      const [bucketExists] = await bucket.exists();
      
      if (!bucketExists) {
        console.log(`Creating new bucket: ${bucketName}`);
        await storage.createBucket(bucketName);
      }

      // Attach user and company info to request
      req.user = { uid: decodedToken.uid, email, companyName: userCompany };
      req.company = { name: headerCompany, bucket, bucketName };


      console.log('Validation successful:', {
        user: req.user,
        company: {
          name: req.company.name,
          bucketName: req.company.bucketName
        }
      });

      next();
    } catch (tokenError) {
      console.error('Token verification failed:', {
        error: tokenError.message,
        code: tokenError.code,
        tokenLength: token?.length
      });
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  } catch (error) {
    console.error('Company validation error:', {
      error: error.message,
      stack: error.stack,
      headers: {
        company: req.headers['x-company-name'],
        hasAuth: !!req.headers.authorization
      }
    });
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Authentication token expired. Please refresh your token.' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error during company validation' 
    });
  }
};
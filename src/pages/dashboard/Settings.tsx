import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { normalizeCompanyName } from '@/utils/organizationValidation';
import { Lock, Building, Settings as SettingsIcon } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';

import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword,
  updateEmail 
} from 'firebase/auth';


interface SecurityFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  isChangingPassword: boolean;
  passwordError: string | null;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
}


interface AISettings {
  enableAIFeatures: boolean;
  personalizedSuggestions: boolean;
  dataSharing: boolean;
}

interface OrganizationFormData {
  name: string;
  companyType: string;
  specialization: string;
  size: string;
  address: string;
  billingEmail: string;
  projectTypes: string[];
  servicesOffered: string[];
}


// Constants for AEC industry options
const AEC_COMPANY_TYPES = {
  ARCHITECTURE: 'architecture',
  ENGINEERING: 'engineering',
  GENERAL_CONTRACTOR: 'general_contractor',
  SUBCONTRACTOR: 'subcontractor',
  CONSULTANT: 'consultant',
  OWNER: 'owner',
  VENDOR: 'vendor'
} as const;

const SPECIALIZATIONS = {
  // Architecture
  RESIDENTIAL: 'residential_architecture',
  COMMERCIAL: 'commercial_architecture',
  INSTITUTIONAL: 'institutional_architecture',
  INDUSTRIAL: 'industrial_architecture',
  URBAN_PLANNING: 'urban_planning',
  INTERIOR_DESIGN: 'interior_design',
  LANDSCAPE: 'landscape_architecture',
  
  // Engineering
  STRUCTURAL: 'structural_engineering',
  MECHANICAL: 'mechanical_engineering',
  ELECTRICAL: 'electrical_engineering',
  CIVIL: 'civil_engineering',
  GEOTECHNICAL: 'geotechnical_engineering',
  
  // Construction
  NEW_CONSTRUCTION: 'new_construction',
  RENOVATION: 'renovation',
  DESIGN_BUILD: 'design_build',
  
  // Specialty Contractors
  HVAC: 'hvac',
  PLUMBING: 'plumbing',
  ELECTRICAL_CONTRACTING: 'electrical_contracting',
  CONCRETE: 'concrete',
  STEEL: 'steel',
  MASONRY: 'masonry',
  ROOFING: 'roofing',
  GLAZING: 'glazing',
  
  // Consultants
  SUSTAINABILITY: 'sustainability',
  ACOUSTICS: 'acoustics',
  LIGHTING: 'lighting',
  COST_ESTIMATION: 'cost_estimation',
  CODE_COMPLIANCE: 'code_compliance',
  FIRE_PROTECTION: 'fire_protection'
} as const;

const PROJECT_TYPES = {
  RESIDENTIAL_SINGLE: 'residential_single_family',
  RESIDENTIAL_MULTI: 'residential_multi_family',
  COMMERCIAL_OFFICE: 'commercial_office',
  COMMERCIAL_RETAIL: 'commercial_retail',
  HEALTHCARE: 'healthcare',
  EDUCATION: 'education',
  GOVERNMENT: 'government',
  HOSPITALITY: 'hospitality',
  INDUSTRIAL_MANUFACTURING: 'industrial_manufacturing',
  INFRASTRUCTURE: 'infrastructure',
  CULTURAL: 'cultural',
  SPORTS_RECREATION: 'sports_recreation',
  TRANSPORTATION: 'transportation',
  MIXED_USE: 'mixed_use'
} as const;

// Helper function to convert enum-like objects to SelectItem array
const convertToSelectItems = (obj: Record<string, string>) => {
  return Object.entries(obj).map(([key, value]) => ({
    value,
    label: key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }));
};




const Settings: React.FC = () => {
  const { user, userProfile, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const location = useLocation();
  const defaultTab = location.state?.defaultTab || 'profile';

  const [activeTab, setActiveTab] = useState(defaultTab);


  const [securityState, setSecurityState] = useState<SecurityFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    isChangingPassword: false,
    passwordError: null
  });

  const [org, setOrg] = useState<OrganizationFormData>({
    name: '',
    companyType: '',
    specialization: '',
    size: '',
    address: '',
    billingEmail: '',
    projectTypes: [],
    servicesOffered: []
  });

  const [profile, setProfile] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: ''
  });

  const [aiSettings, setAISettings] = useState<AISettings>({
    enableAIFeatures: true,
    personalizedSuggestions: true,
    dataSharing: false
  });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });



  useEffect(() => {
    const loadData = async () => {
      if (!user?.email) return;
      
      try {
        const companyName = normalizeCompanyName(user.email);
        const userDocRef = doc(db, 'companies', companyName, 'users', user.uid);
        const orgDocRef = doc(db, 'companies', companyName);
        
        const [userDoc, orgDoc] = await Promise.all([
          getDoc(userDocRef),
          getDoc(orgDocRef)
        ]);
  
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfile({
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: user.email || '',
            phone: userData.phone || '',
            jobTitle: userData.jobTitle || ''
          });
          setAISettings(userData.aiSettings || {
            enableAIFeatures: true,
            personalizedSuggestions: true,
            dataSharing: false
          });
        }
  
        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          setOrg({
            name: orgData.name || '',
            companyType: orgData.companyType || '',
            specialization: orgData.specialization || '',
            size: orgData.size || '',
            address: orgData.address || '',
            billingEmail: orgData.billingEmail || '',
            projectTypes: orgData.projectTypes || [],
            servicesOffered: orgData.servicesOffered || []
          });
        }
  
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load settings');
        setLoading(false);
      }
    };
  
    loadData();
  }, [user]);

  
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    try {
      const companyName = normalizeCompanyName(user.email);
      const userDocRef = doc(db, 'companies', companyName, 'users', user.uid);
      
      await setDoc(userDocRef, {
        ...profile,
        aiSettings,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSuccessMessage('Profile updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleOrganizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    try {
      const companyName = normalizeCompanyName(user.email);
      const orgDocRef = doc(db, 'companies', companyName);
      
      await setDoc(orgDocRef, {
        ...org,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSuccessMessage('Organization updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating organization:', err);
      setError('Failed to update organization');
      setTimeout(() => setError(null), 3000);
    }
  };

  
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return 'Password must contain at least one special character (!@#$%^&*)';
    }
    return null;
  };


  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    setSecurityState(prev => ({ ...prev, isChangingPassword: true, passwordError: null }));

    try {
      // Validate new password
      const { currentPassword, newPassword, confirmPassword } = securityState;

      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match');
      }

      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        throw new Error(passwordError);
      }

      // Create credentials and reauthenticate
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Clear form and show success
      setSecurityState(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        passwordError: null
      }));

      setSuccessMessage('Password updated successfully');
    } catch (err) {
      console.error('Password update error:', err);
      let errorMessage = 'Failed to update password';
      
      // Handle specific Firebase errors
      if (err instanceof Error) {
        switch (err.message) {
          case 'auth/wrong-password':
            errorMessage = 'Current password is incorrect';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many attempts. Please try again later';
            break;
          case 'auth/requires-recent-login':
            errorMessage = 'Please log out and log back in to change your password';
            break;
          default:
            errorMessage = err.message;
        }
      }
      
      setSecurityState(prev => ({ 
        ...prev, 
        passwordError: errorMessage 
      }));
    } finally {
      setSecurityState(prev => ({ ...prev, isChangingPassword: false }));
    }
  };

  
  if (!isAuthenticated || !user?.email) {
    return null;
  }


  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}

<Tabs 
      value={activeTab} 
      onValueChange={setActiveTab}
      className="space-y-6"
    >          
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Manage your personal information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profile.firstName}
                        onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profile.lastName}
                        onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input
                      id="jobTitle"
                      value={profile.jobTitle}
                      onChange={(e) => setProfile({...profile, jobTitle: e.target.value})}
                    />
                  </div>
                  <Button type="submit">Update Profile</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organization">
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>
            Manage your organization's information and AEC industry profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOrganizationSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={org.name}
                onChange={(e) => setOrg({...org, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="companyType">Company Type</Label>
              <Select
                value={org.companyType}
                onValueChange={(value) => setOrg({...org, companyType: value})}
              >
                <SelectTrigger id="companyType">
                  <SelectValue placeholder="Select company type" />
                </SelectTrigger>
                <SelectContent>
                  {convertToSelectItems(AEC_COMPANY_TYPES).map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialization">Primary Specialization</Label>
              <Select
                value={org.specialization}
                onValueChange={(value) => setOrg({...org, specialization: value})}
              >
                <SelectTrigger id="specialization">
                  <SelectValue placeholder="Select specialization" />
                </SelectTrigger>
                <SelectContent>
                  {convertToSelectItems(SPECIALIZATIONS).map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Company Size</Label>
              <Select
                value={org.size}
                onValueChange={(value) => setOrg({...org, size: value})}
              >
                <SelectTrigger id="size">
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="501-1000">501-1000 employees</SelectItem>
                  <SelectItem value="1000+">1000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectTypes">Project Types</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {convertToSelectItems(PROJECT_TYPES).map(item => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={item.value}
                      checked={org.projectTypes.includes(item.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setOrg({
                            ...org,
                            projectTypes: [...org.projectTypes, item.value]
                          });
                        } else {
                          setOrg({
                            ...org,
                            projectTypes: org.projectTypes.filter(t => t !== item.value)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={item.value}>{item.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={org.address}
                onChange={(e) => setOrg({...org, address: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingEmail">Billing Email</Label>
              <Input
                id="billingEmail"
                type="email"
                value={org.billingEmail}
                onChange={(e) => setOrg({...org, billingEmail: e.target.value})}
              />
            </div>

            <Button type="submit">Update Organization</Button>
          </form>
        </CardContent>
      </Card>
    </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>AI Features & Privacy</CardTitle>
                  <CardDescription>
                    Manage AI-related settings and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable AI Features</Label>
                      <p className="text-sm text-gray-500">Use AI to enhance your experience</p>
                    </div>
                    <Switch
                      checked={aiSettings.enableAIFeatures}
                      onCheckedChange={(checked) => 
                        setAISettings({...aiSettings, enableAIFeatures: checked})
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Personalized Suggestions</Label>
                      <p className="text-sm text-gray-500">Allow AI to make personalized recommendations</p>
                    </div>
                    <Switch
                      checked={aiSettings.personalizedSuggestions}
                      onCheckedChange={(checked) => 
                        setAISettings({...aiSettings, personalizedSuggestions: checked})
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Data Sharing</Label>
                      <p className="text-sm text-gray-500">Share anonymous data to improve AI features</p>
                    </div>
                    <Switch
                      checked={aiSettings.dataSharing}
                      onCheckedChange={(checked) => 
                        setAISettings({...aiSettings, dataSharing: checked})
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>
          Update your password and security preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={securityState.currentPassword}
              onChange={(e) => setSecurityState(prev => ({
                ...prev,
                currentPassword: e.target.value
              }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={securityState.newPassword}
              onChange={(e) => setSecurityState(prev => ({
                ...prev,
                newPassword: e.target.value
              }))}
              required
            />
            <p className="text-sm text-gray-500">
              Password must be at least 8 characters long and contain uppercase, 
              lowercase, number, and special character
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={securityState.confirmPassword}
              onChange={(e) => setSecurityState(prev => ({
                ...prev,
                confirmPassword: e.target.value
              }))}
              required
            />
          </div>

          {securityState.passwordError && (
            <div className="text-red-500 text-sm">
              {securityState.passwordError}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={securityState.isChangingPassword}
          >
            {securityState.isChangingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};


export default Settings;
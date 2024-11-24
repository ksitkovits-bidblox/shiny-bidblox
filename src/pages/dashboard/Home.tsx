// src/pages/dashboard/Home.tsx
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  FileText, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle 
} from 'lucide-react';

// Sample data
const rfpMetrics = {
  activeRfps: 12,
  completedThisMonth: 8,
  averageResponse: '4.2 days',
  winRate: '68%'
};

const recentRfps = [
  {
    id: '1',
    projectName: 'Downtown Cultural Center',
    client: 'City of Pickering',
    dueDate: '2024-11-20',
    status: 'in-progress',
    value: '$2.8M',
    type: 'Cultural'
  },
  {
    id: '2',
    projectName: 'Tech Campus Building B',
    client: 'TechCorp Inc.',
    dueDate: '2024-11-15',
    status: 'pending',
    value: '$5.1M',
    type: 'Commercial'
  },
  {
    id: '3',
    projectName: 'University Library Renovation',
    client: 'York University',
    dueDate: '2024-11-25',
    status: 'submitted',
    value: '$3.2M',
    type: 'Educational'
  },
  {
    id: '4',
    projectName: 'Sustainable Housing Complex',
    client: 'Green Living Ltd',
    dueDate: '2024-12-01',
    status: 'won',
    value: '$4.5M',
    type: 'Residential'
  },
  {
    id: '5',
    projectName: 'Medical Center Extension',
    client: 'Healthcare Partners',
    dueDate: '2024-11-18',
    status: 'lost',
    value: '$6.7M',
    type: 'Healthcare'
  }
];

const getStatusColor = (status: string) => {
  const colors = {
    'in-progress': 'bg-yellow-100 text-yellow-800',
    'pending': 'bg-blue-100 text-blue-800',
    'submitted': 'bg-purple-100 text-purple-800',
    'won': 'bg-green-100 text-green-800',
    'lost': 'bg-red-100 text-red-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getStatusIcon = (status: string) => {
  const icons = {
    'in-progress': <Clock className="h-4 w-4" />,
    'pending': <AlertCircle className="h-4 w-4" />,
    'submitted': <FileText className="h-4 w-4" />,
    'won': <CheckCircle2 className="h-4 w-4" />,
    'lost': <XCircle className="h-4 w-4" />
  };
  return icons[status as keyof typeof icons] || <FileText className="h-4 w-4" />;
};

const Home: React.FC = () => {
  const { userProfile } = useAuth(); // Add this
  console.log('Home Component Rendering:', {
    timestamp: new Date().toISOString(),
    hasProfile: !!userProfile,
    profileData: {
      companyName: userProfile?.companyName,
      role: userProfile?.role,
      department: userProfile?.department
    }
  }); 
    // Verify data
    React.useEffect(() => {
      console.log('Home Component Mounted:', {
        rfpMetrics,
        recentRfps: recentRfps.length,
        hasUserProfile: !!userProfile,
        companyName: userProfile?.companyName
      });
    }, [userProfile]);
  return (
    <DashboardLayout>
      <div className="space-y-4">
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {userProfile && (
              <p className="text-gray-600">
 {userProfile.companyName.charAt(0).toUpperCase() + userProfile.companyName.slice(1)} - {userProfile.department}
 </p>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center">
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Active RFPs</p>
                  <p className="text-2xl font-bold">{rfpMetrics.activeRfps}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Completed This Month</p>
                  <p className="text-2xl font-bold">{rfpMetrics.completedThisMonth}</p>
                </div>
                <Building2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Average Response Time</p>
                  <p className="text-2xl font-bold">{rfpMetrics.averageResponse}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Win Rate</p>
                  <p className="text-2xl font-bold">{rfpMetrics.winRate}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent RFPs Table */}
        <div className="rounded-md border border-gray-100 bg-white">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent RFPs</CardTitle>
              <CardDescription className="text-gray-500">
                Track your recent RFP submissions and their status
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold text-gray-900">Project Name</TableHead>
                    <TableHead className="font-semibold text-gray-900">Client</TableHead>
                    <TableHead className="font-semibold text-gray-900">Type</TableHead>
                    <TableHead className="font-semibold text-gray-900">Value</TableHead>
                    <TableHead className="font-semibold text-gray-900">Due Date</TableHead>
                    <TableHead className="font-semibold text-gray-900">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRfps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No recent RFPs. Please add new data to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentRfps.map((rfp) => (
                      <TableRow key={rfp.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{rfp.projectName}</TableCell>
                        <TableCell>{rfp.client}</TableCell>
                        <TableCell>{rfp.type}</TableCell>
                        <TableCell>{rfp.value}</TableCell>
                        <TableCell>{new Date(rfp.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(rfp.status)}
                            <Badge className={getStatusColor(rfp.status)}>
                              {rfp.status.charAt(0).toUpperCase() + rfp.status.slice(1)}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Home;

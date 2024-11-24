import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollText, Loader2, Calendar, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';  
import { companyApi, makeRequest } from '@/utils/api';



// Add Timestamp type
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

interface Proposal {
  id: string;
  projectId: string;
  projectName: string;
  organization: string;
  category: 'construction' | 'renovation' | 'infrastructure' | 'consulting';
  dueDate: Date | FirestoreTimestamp;
  createdAt: string;
  status: 'draft' | 'in-progress' | 'review' | 'submitted' | 'cancelled';
  generatedOutline?: string;
}




const CATEGORIES = ['construction', 'renovation', 'infrastructure', 'consulting'] as const;
const STATUSES = ['draft', 'in-progress', 'review', 'submitted', 'cancelled'] as const;

// Helper function to convert any date type to Date object
const toDate = (date: Date | FirestoreTimestamp | string | null): Date | undefined => {
  if (!date) return undefined;
  
  if (isFirestoreTimestamp(date)) {
    return new Date(date.seconds * 1000);
  }
  if (typeof date === 'string') {
    return parseISO(date);
  }
  if (date instanceof Date) {
    return date;
  }
  return undefined;
};

// Helper function to check if value is a Firestore Timestamp
const isFirestoreTimestamp = (value: any): value is FirestoreTimestamp => {
  return value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value;
};

const getCategoryColor = (category: string) => {
  const colors = {
    construction: 'bg-blue-100 text-blue-800',
    renovation: 'bg-purple-100 text-purple-800',
    infrastructure: 'bg-green-100 text-green-800',
    consulting: 'bg-orange-100 text-orange-800',
  };
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getStatusColor = (status: string) => {
  const colors = {
    draft: 'bg-gray-100 text-gray-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    review: 'bg-blue-100 text-blue-800',
    submitted: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const formatDate = (date: Date | FirestoreTimestamp | string | null): string => {
  const converted = toDate(date);
  if (!converted || !isValid(converted)) return 'No date';
  return format(converted, 'MMM d, yyyy');
};

const Proposals: React.FC = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null);
  const { userProfile, user, isAuthenticated } = useAuth(); 
  const [successMessage, setSuccessMessage] = useState<string | null>(null);



  interface RawProposalResponse extends Omit<Proposal, 'dueDate'> {
    dueDate: string | null;
    alreadyExists?: boolean;
  }

  // Effect to fetch proposals when authenticated
  useEffect(() => {
    if (isAuthenticated && userProfile?.companyName) {
      fetchProposals();
    }
  }, [isAuthenticated, userProfile?.companyName]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      const fetchedProposals = await api.proposals.getAll();
  
      setProposals(fetchedProposals.map((p: RawProposalResponse): Proposal => ({
        ...p,
        dueDate: toDate(p.dueDate) || new Date()
      })));
    } catch (error) {
      console.error('Error fetching proposals:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  };


  const handleUpdateCategory = async (proposalId: string, category: Proposal['category']) => {
    if (!userProfile?.companyName || !user) {
      console.log('Missing required data for category update:', {
        company: userProfile?.companyName,
        hasUser: !!user
      });
      return;
    }
  
    setUpdatingId(proposalId);
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      console.log('Updating proposal category:', {
        proposalId,
        category,
        company: userProfile.companyName
      });
  
      const updatedProposal = await api.proposals.update(
        proposalId,
        {
          companyName: userProfile.companyName,
          category
        }
      );
  
      setProposals(prev => prev.map(p => 
        p.id === proposalId ? { ...p, category: updatedProposal.category } : p
      ));
  
      setSuccessMessage('Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      setError(error instanceof Error ? error.message : 'Failed to update category');
    } finally {
      setUpdatingId(null);
    }
  };


  const handleUpdateStatus = async (proposalId: string, status: Proposal['status']) => {
    if (!userProfile?.companyName || !user) {
      console.log('Missing required data for status update:', {
        company: userProfile?.companyName,
        hasUser: !!user
      });
      return;
    }
  
    setUpdatingId(proposalId);
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      console.log('Updating proposal status:', {
        proposalId,
        status,
        company: userProfile.companyName
      });
  
      // Call the API with the proper parameters
      const updatedProposal = await api.proposals.update(
        proposalId, 
        {
          companyName: userProfile.companyName,
          status 
        }
      );
  
      setProposals(prev => prev.map(p => 
        p.id === proposalId ? { ...p, status: updatedProposal.status } : p
      ));
  
      setSuccessMessage('Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateDueDate = async (proposalId: string, dueDate: Date) => {
    if (!userProfile?.companyName || !user) {
      console.log('Missing required data for due date update:', {
        company: userProfile?.companyName,
        hasUser: !!user
      });
      return;
    }
  
    setUpdatingId(proposalId);
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      console.log('Updating proposal due date:', {
        proposalId,
        dueDate: dueDate.toISOString(),
        company: userProfile.companyName
      });
  
      const updatedProposal = await api.proposals.update(
        proposalId,
        {
          companyName: userProfile.companyName,
          dueDate: dueDate.toISOString()
        }
      );
  
      setProposals(prev => prev.map(p => 
        p.id === proposalId ? { ...p, dueDate: toDate(updatedProposal.dueDate) || new Date() } : p
      ));
  
      setSuccessMessage('Due date updated successfully');
    } catch (error) {
      console.error('Error updating due date:', error);
      setError(error instanceof Error ? error.message : 'Failed to update due date');
    } finally {
      setUpdatingId(null);
    }
  };


  const handleUpdateProposal = async (id: string, updateData: Partial<Proposal>) => {
    setUpdatingId(id);
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      const apiData = {
        ...updateData,
        dueDate: updateData.dueDate instanceof Date 
          ? updateData.dueDate.toISOString()
          : updateData.dueDate
      };
  
      const updatedProposal: RawProposalResponse = await api.proposals.update(id, apiData);
  
      setProposals(prev => prev.map((p: Proposal): Proposal => 
        p.id === id ? {
          ...p,
          ...updatedProposal,
          dueDate: toDate(updatedProposal.dueDate) || new Date()
        } : p
      ));
  
      setSuccessMessage('Proposal updated successfully');
    } catch (error) {
      console.error('Error updating proposal:', error);
      setError(error instanceof Error ? error.message : 'Failed to update proposal');
    } finally {
      setUpdatingId(null);
    }
  };


  const handleDeleteProposal = async () => {
    if (!proposalToDelete || !userProfile?.companyName || !user) {
      console.log('Missing required data for delete:', {
        hasProposal: !!proposalToDelete,
        company: userProfile?.companyName,
        hasUser: !!user
      });
      return;
    }
  
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      const companyName = userProfile.companyName.toLowerCase();
      
      console.log('Deleting proposal:', {
        proposalId: proposalToDelete.id,
        company: companyName,
        path: `/companies/${companyName}/proposals/${proposalToDelete.id}`
      });
  
      // Call the API delete method
      await api.proposals.delete(proposalToDelete.id);
      
      setProposals(prev => prev.filter(p => p.id !== proposalToDelete.id));
      setProposalToDelete(null);
      setSuccessMessage('Proposal deleted successfully');
    } catch (error) {
      console.error('Error deleting proposal:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete proposal');
    }
  };

  const handleView = (proposalId: string) => {
    try {
      console.log('Navigating to proposal:', { proposalId });
      navigate(`/proposal/${proposalId}`);
    } catch (error) {
      console.error('Error navigating to proposal:', error);
      setError(error instanceof Error ? error.message : 'Failed to navigate to proposal');
    }
  };
  

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Proposals</h1>
          {/*<Button onClick={() => navigate('/proposal/new')}>
            <ScrollText className="mr-2 h-4 w-4" />
            New Proposal
          </Button>*/}
        </div>
        
               {/* Error and Success Messages */}
               {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md">
            {successMessage}
          </div>
        )}

        <div className="rounded-md border border-gray-100 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-900">Project Name</TableHead>
                <TableHead className="font-semibold text-gray-900">Organization</TableHead>
                <TableHead className="font-semibold text-gray-900">Category</TableHead>
                <TableHead className="font-semibold text-gray-900">Due Date</TableHead>
                <TableHead className="font-semibold text-gray-900">Status</TableHead>
                <TableHead className="text-right font-semibold text-gray-900">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals
                .filter((proposal: Proposal) => proposal.status !== 'cancelled')
                .map((proposal: Proposal) => (
                  <TableRow key={proposal.id} className="hover:bg-gray-50 border-gray-100">
                    <TableCell className="font-medium text-gray-900">
                      {proposal.projectName}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {proposal.organization}
                    </TableCell>
                    <TableCell>
                    <Select
                        value={proposal.category}
                        onValueChange={(value: typeof proposal.category) => 
                          handleUpdateCategory(proposal.id, value)
                        }
                        disabled={updatingId === proposal.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((category) => (
                            <SelectItem 
                              key={category} 
                              value={category}
                              className={getCategoryColor(category)}
                            >
                              {category.charAt(0).toUpperCase() + category.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[130px]">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-[130px] px-2 justify-start text-left font-normal",
                              !proposal.dueDate && "text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate text-sm">
                                {formatDate(proposal.dueDate)}
                              </span>
                            </div>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                            mode="single"
                            selected={toDate(proposal.dueDate)}
                            onSelect={(date) => {
                              if (date) {
                                handleUpdateDueDate(proposal.id, date);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={proposal.status}
                        onValueChange={(value: typeof proposal.status) => 
                          handleUpdateStatus(proposal.id, value)
                        }
                        disabled={updatingId === proposal.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((status) => (
                            <SelectItem 
                              key={status} 
                              value={status}
                              className={getStatusColor(status)}
                            >
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(proposal.id)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setProposalToDelete(proposal)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!proposalToDelete} onOpenChange={(open) => !open && setProposalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the proposal "{proposalToDelete?.projectName}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProposal}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Proposals;